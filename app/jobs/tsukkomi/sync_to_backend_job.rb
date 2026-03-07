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
        viewport: feedback.viewport
      }

      begin
        backend_results = Tsukkomi::Backends::Registry.submit_to_all(task_data, feedback_data)
        task.update!(status: "synced", backend_results: backend_results.to_json, synced_at: Time.current)
      rescue => e
        task.update!(status: "failed", backend_results: { error: e.message }.to_json)
        raise
      end
    end
  end
end
