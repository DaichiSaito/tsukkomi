module Tsukkomi
  class ProcessFeedbackJob < ApplicationJob
    queue_as :default

    def perform(feedback_id)
      feedback = Tsukkomi::Feedback.find(feedback_id)

      generator = Tsukkomi::Llm::TaskGenerator.new
      result = generator.generate(build_feedback_data(feedback))

      task = feedback.create_task!(
        title: result["title"] || result[:title],
        category: result["category"] || result[:category],
        description: result["description"] || result[:description],
        labels: result["labels"] || result[:labels],
        status: "pending"
      )

      return unless Tsukkomi.configuration.backend.present?

      begin
        backend_results = Tsukkomi::Backends::Registry.submit_to_all(
          result, build_feedback_data(feedback)
        )
        task.update!(status: "synced", backend_results: backend_results.to_json, synced_at: Time.current)
      rescue => e
        task.update!(status: "failed", backend_results: { error: e.message }.to_json)
      end
    end

    private

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
  end
end
