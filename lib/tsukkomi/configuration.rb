module Tsukkomi
  class Configuration
    attr_accessor :backend, :github_repo, :github_token,
                  :vibe_kanban_project_id, :vibe_kanban_project,
                  :anthropic_api_key, :claude_model,
                  :auto_inject, :reporter, :task_prompt

    def initialize
      @backend = nil
      @github_repo = nil
      @github_token = nil
      @vibe_kanban_project_id = nil
      @vibe_kanban_project = nil
      @anthropic_api_key = ENV["ANTHROPIC_API_KEY"]
      @claude_model = "claude-sonnet-4-20250514"
      @auto_inject = true
      @reporter = "anonymous"
      @task_prompt = nil
    end
  end
end
