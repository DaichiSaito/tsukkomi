module Tsukkomi
  module Api
    class FeedbacksController < ApplicationController
      include ActionController::Live

      skip_before_action :verify_authenticity_token
      before_action :set_feedback, only: [:status]

      # GET /api/feedbacks
      def index
        feedbacks = Tsukkomi::Feedback.includes(:task).order(created_at: :desc)
        render json: { status: "ok", feedbacks: feedbacks.map { |f| serialize_feedback(f) } }
      end

      # POST /api/feedbacks
      def create
        feedback = Tsukkomi::Feedback.new(feedback_params)
        feedback.submitted_at = Time.current

        unless feedback.save
          return render json: { error: feedback.errors.full_messages.join(", ") }, status: :unprocessable_entity
        end

        attach_screenshot(feedback)

        if request.headers["X-Async"] == "true"
          Tsukkomi::ProcessFeedbackJob.perform_later(feedback.id)
          render json: { feedbackId: feedback.id, status: "accepted" }, status: :accepted
        else
          process_feedback_sync(feedback)
        end
      end

      # POST /api/feedbacks/preview
      def preview
        feedback = Tsukkomi::Feedback.new(feedback_params)
        feedback.submitted_at = Time.current

        unless feedback.save
          return render json: { error: feedback.errors.full_messages.join(", ") }, status: :unprocessable_entity
        end

        attach_screenshot(feedback)

        generator = Tsukkomi::Llm::TaskGenerator.new
        result = generator.generate(build_feedback_data(feedback))

        preview_id = SecureRandom.uuid
        Rails.cache.write("tsukkomi:preview:#{preview_id}", { feedback_id: feedback.id, task: result }, expires_in: 10.minutes)

        render json: {
          previewId: preview_id,
          feedbackId: feedback.id,
          task: result
        }
      end

      # POST /api/feedbacks/confirm
      def confirm
        preview_id = params[:previewId] || params[:preview_id]
        cached = Rails.cache.read("tsukkomi:preview:#{preview_id}")

        unless cached
          return render json: { error: "Preview not found or expired" }, status: :not_found
        end

        feedback = Tsukkomi::Feedback.find(cached[:feedback_id])
        task_data = cached[:task]

        task = feedback.create_task!(
          title: task_data["title"] || task_data[:title],
          category: task_data["category"] || task_data[:category],
          description: task_data["description"] || task_data[:description],
          labels: task_data["labels"] || task_data[:labels],
          status: "pending"
        )

        sync_to_backend = params.fetch(:sync_to_backend, true)
        sync_to_backend = sync_to_backend != "false" && sync_to_backend != false

        if sync_to_backend && Tsukkomi.configuration.backend.present?
          begin
            backend_results = Tsukkomi::Backends::Registry.submit_to_all(
              task_data, build_feedback_data(feedback)
            )
            task.update!(status: "synced", backend_results: backend_results.to_json, synced_at: Time.current)
          rescue => e
            task.update!(status: "failed", backend_results: { error: e.message }.to_json)
          end
        end

        Rails.cache.delete("tsukkomi:preview:#{preview_id}")

        render json: {
          feedbackId: feedback.id,
          task: {
            id: task.id,
            title: task.title,
            category: task.category,
            description: task.description,
            labels: task.labels,
            status: task.status
          }
        }
      end

      # GET /api/feedbacks/:id/status
      def status
        response.headers["Content-Type"] = "text/event-stream"
        response.headers["Cache-Control"] = "no-cache"
        response.headers["X-Accel-Buffering"] = "no"

        task = @feedback.task

        if task
          data = {
            step: task.status == "synced" ? "completed" : "pending",
            task: { title: task.title, category: task.category }
          }
          response.stream.write("event: status\ndata: #{data.to_json}\n\n")
        else
          data = { step: "llm_processing", message: "AIがタスクを生成中..." }
          response.stream.write("event: status\ndata: #{data.to_json}\n\n")
        end

        response.stream.close
      rescue ActionController::Live::ClientDisconnected
        # client disconnected
      ensure
        response.stream.close rescue nil
      end

      private

      def set_feedback
        @feedback = Tsukkomi::Feedback.find(params[:id])
      end

      def feedback_params
        params.permit(:comment, :page_url, :selector, :browser, :reporter, coordinates: {}, viewport: {})
      end

      def attach_screenshot(feedback)
        screenshot_data = params[:screenshot]
        return unless screenshot_data.present? && screenshot_data.is_a?(String) && screenshot_data.include?("base64,")

        mime_type, encoded = screenshot_data.split(",", 2)
        content_type = mime_type[/data:(.*?);/, 1] || "image/png"
        extension = content_type == "image/jpeg" ? "jpg" : "png"
        decoded = Base64.decode64(encoded)

        feedback.screenshot.attach(
          io: StringIO.new(decoded),
          filename: "screenshot_#{feedback.id}.#{extension}",
          content_type: content_type
        )
      end

      def process_feedback_sync(feedback)
        generator = Tsukkomi::Llm::TaskGenerator.new
        result = generator.generate(build_feedback_data(feedback))

        task = feedback.create_task!(
          title: result["title"] || result[:title],
          category: result["category"] || result[:category],
          description: result["description"] || result[:description],
          labels: result["labels"] || result[:labels],
          status: "pending"
        )

        if Tsukkomi.configuration.backend.present?
          begin
            backend_results = Tsukkomi::Backends::Registry.submit_to_all(
              result, build_feedback_data(feedback)
            )
            task.update!(status: "synced", backend_results: backend_results.to_json, synced_at: Time.current)
          rescue => e
            task.update!(status: "failed", backend_results: { error: e.message }.to_json)
          end
        end

        render json: {
          feedbackId: feedback.id,
          task: {
            id: task.id,
            title: task.title,
            category: task.category,
            description: task.description,
            labels: task.labels,
            status: task.status
          }
        }
      end

      def build_feedback_data(feedback)
        {
          comment: feedback.comment,
          page_url: feedback.page_url,
          selector: feedback.selector,
          coordinates: feedback.coordinates,
          browser: feedback.browser,
          viewport: feedback.viewport,
          timestamp: feedback.submitted_at&.iso8601,
          screenshot: feedback.screenshot.attached? ? screenshot_data_url(feedback) : nil
        }
      end

      def screenshot_data_url(feedback)
        blob = feedback.screenshot.blob
        content_type = blob.content_type
        data = blob.download
        encoded = Base64.strict_encode64(data)
        "data:#{content_type};base64,#{encoded}"
      end

      def serialize_feedback(feedback)
        {
          id: feedback.id,
          comment: feedback.comment,
          pageUrl: feedback.page_url,
          selector: feedback.selector,
          coordinates: feedback.coordinates,
          browser: feedback.browser,
          viewport: feedback.viewport,
          submittedAt: feedback.submitted_at&.iso8601,
          hasScreenshot: feedback.screenshot.attached?,
          task: feedback.task ? {
            id: feedback.task.id,
            title: feedback.task.title,
            category: feedback.task.category,
            status: feedback.task.status,
            backendResults: feedback.task.backend_results
          } : nil
        }
      end
    end
  end
end
