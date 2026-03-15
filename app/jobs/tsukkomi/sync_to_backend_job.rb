module Tsukkomi
  class SyncToBackendJob < ApplicationJob
    queue_as :default

    def perform(task_id)
      task = Tsukkomi::Task.find(task_id)
      feedback = task.feedback

      task_data = {
        title: task.title,
        category: task.category,
        description: task.description,
        labels: task.labels
      }

      feedback_data = {
        comment: feedback.comment,
        page_url: feedback.page_url,
        selector: feedback.selector,
        coordinates: feedback.coordinates,
        browser: feedback.browser,
        viewport: feedback.viewport,
        screenshot: feedback.screenshot.attached? ? blob_to_data_url(feedback.screenshot) : nil,
        cropped_screenshot: feedback.cropped_screenshot.attached? ? blob_to_data_url(feedback.cropped_screenshot) : nil
      }

      begin
        backend_results = Tsukkomi::Backends::Registry.submit_to_all(task_data, feedback_data)

        if backend_results[:any_succeeded]
          task.update!(status: "synced", backend_results: backend_results.to_json, synced_at: Time.current)
        else
          task.update!(status: "failed", backend_results: backend_results.to_json)
        end
      rescue => e
        task.update!(status: "failed", backend_results: { error: e.message }.to_json)
        raise
      end
    end

    private

    def blob_to_data_url(attachment)
      blob = attachment.blob
      content_type = blob.content_type
      data = blob.download
      encoded = Base64.strict_encode64(data)
      "data:#{content_type};base64,#{encoded}"
    end
  end
end
