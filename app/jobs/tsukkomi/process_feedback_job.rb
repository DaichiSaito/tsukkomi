module Tsukkomi
  class ProcessFeedbackJob < ApplicationJob
    queue_as :default

    def perform(feedback_id)
      feedback = Tsukkomi::Feedback.find(feedback_id)

      # Create a placeholder task with "processing" status
      task = feedback.task || feedback.create_task!(
        title: "処理中...",
        category: "improvement",
        description: "",
        status: "processing"
      )

      begin
        generator = Tsukkomi::Llm::TaskGenerator.new
        result = generator.generate(build_feedback_data(feedback))

        task.update!(
          title: result["title"] || result[:title],
          category: result["category"] || result[:category],
          description: result["description"] || result[:description],
          labels: result["labels"] || result[:labels],
          status: "generated"
        )
      rescue => e
        task.update!(status: "failed", backend_results: { error: e.message }.to_json)
        raise
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
        screenshot: feedback.screenshot.attached? ? blob_to_data_url(feedback.screenshot) : nil,
        cropped_screenshot: feedback.cropped_screenshot.attached? ? blob_to_data_url(feedback.cropped_screenshot) : nil
      }
    end

    def blob_to_data_url(attachment)
      blob = attachment.blob
      content_type = blob.content_type
      data = blob.download
      encoded = Base64.strict_encode64(data)
      "data:#{content_type};base64,#{encoded}"
    end
  end
end
