module Tsukkomi
  class Configuration
    LLM_MODES = %i[auto api cli].freeze
    GITHUB_AUTH_MODES = %i[auto token gh_cli].freeze

    attr_accessor :backend, :github_repo, :github_token,
                  :vibe_kanban_project_id, :vibe_kanban_project,
                  :anthropic_api_key, :claude_model,
                  :auto_inject, :reporter, :task_prompt

    attr_reader :llm_mode, :github_auth_mode

    def initialize
      @backend = nil
      @github_repo = nil
      @github_token = nil
      @vibe_kanban_project_id = nil
      @vibe_kanban_project = nil
      @anthropic_api_key = ENV["ANTHROPIC_API_KEY"]
      @claude_model = "claude-sonnet-4-20250514"
      @llm_mode = :auto
      @github_auth_mode = :auto
      @auto_inject = true
      @reporter = "anonymous"
      @task_prompt = nil
    end

    def llm_mode=(mode)
      mode = mode.to_sym
      unless LLM_MODES.include?(mode)
        raise ArgumentError, "llm_mode must be one of #{LLM_MODES.inspect}, got #{mode.inspect}"
      end
      @llm_mode = mode
    end

    def github_auth_mode=(mode)
      mode = mode.to_sym
      unless GITHUB_AUTH_MODES.include?(mode)
        raise ArgumentError, "github_auth_mode must be one of #{GITHUB_AUTH_MODES.inspect}, got #{mode.inspect}"
      end
      @github_auth_mode = mode
    end
  end
end
