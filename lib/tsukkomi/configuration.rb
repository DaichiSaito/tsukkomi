module Tsukkomi
  class Configuration
    attr_accessor :backend, :github_repo, :github_token,
                  :anthropic_api_key, :claude_model,
                  :auto_inject, :reporter, :task_prompt

    def initialize
      @backend = nil
      @github_repo = nil
      @github_token = nil
      @anthropic_api_key = ENV["ANTHROPIC_API_KEY"]
      @claude_model = "claude-sonnet-4-20250514"
      @auto_inject = true
      @reporter = "anonymous"
      @task_prompt = nil
    end
  end
end
