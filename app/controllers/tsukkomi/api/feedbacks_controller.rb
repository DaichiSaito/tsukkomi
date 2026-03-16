module Tsukkomi
  module Api
    class FeedbacksController < ApplicationController
      skip_before_action :verify_authenticity_token
      before_action :set_feedback, only: [:status, :sync_backend]

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
        attach_cropped_screenshot(feedback)

        Tsukkomi::ProcessFeedbackJob.perform_later(feedback.id)
        render json: { feedbackId: feedback.id, status: "accepted" }, status: :accepted
      end

      # GET /api/feedbacks/:id/status
      def status
        task = @feedback.task

        if task
          render json: {
            feedbackId: @feedback.id,
            status: task.status,
            task: {
              id: task.id,
              title: task.title,
              category: task.category,
              description: task.description,
              labels: task.labels,
              status: task.status,
              backendResults: task.backend_results
            }
          }
        else
          render json: { feedbackId: @feedback.id, status: "accepted" }
        end
      end

      # POST /api/feedbacks/:id/sync_backend
      def sync_backend
        task = @feedback.task

        unless task
          return render json: { error: "Task not found" }, status: :not_found
        end

        unless task.status.in?(%w[generated failed])
          return render json: { error: "Task is not ready for backend sync (status: #{task.status})" }, status: :unprocessable_entity
        end

        unless Tsukkomi.configuration.backend.present?
          return render json: { error: "No backend configured" }, status: :unprocessable_entity
        end

        task.update!(status: "pending")
        Tsukkomi::SyncToBackendJob.perform_later(task.id)
        render json: { feedbackId: @feedback.id, taskId: task.id, status: "syncing" }
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
          create_blob(decoded, "screenshot_#{feedback.id}.#{extension}", content_type)
        )
      end

      def attach_cropped_screenshot(feedback)
        cropped_data = params[:cropped_screenshot]
        return unless cropped_data.present? && cropped_data.is_a?(String) && cropped_data.include?("base64,")

        mime_type, encoded = cropped_data.split(",", 2)
        content_type = mime_type[/data:(.*?);/, 1] || "image/png"
        extension = content_type == "image/jpeg" ? "jpg" : "png"
        decoded = Base64.decode64(encoded)

        feedback.cropped_screenshot.attach(
          create_blob(decoded, "cropped_screenshot_#{feedback.id}.#{extension}", content_type)
        )
      end

      def create_blob(decoded, filename, content_type)
        service_name = Tsukkomi.configuration.storage_service
        blob_params = {
          io: StringIO.new(decoded),
          filename: filename,
          content_type: content_type
        }
        blob_params[:service_name] = service_name if service_name
        ActiveStorage::Blob.create_and_upload!(**blob_params)
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
          hasCroppedScreenshot: feedback.cropped_screenshot.attached?,
          task: feedback.task ? {
            id: feedback.task.id,
            title: feedback.task.title,
            category: feedback.task.category,
            description: feedback.task.description,
            labels: feedback.task.labels,
            status: feedback.task.status,
            backendResults: feedback.task.backend_results
          } : nil
        }
      end
    end
  end
end
