# frozen_string_literal: true

require "open3"
require "json"

module Tsukkomi
  module Backends
    class VibeKanban < Base
      ALLOWED_TOOLS = %w[
        mcp__vibe_kanban__list_organizations
        mcp__vibe_kanban__list_projects
        mcp__vibe_kanban__create_issue
        mcp__vibe_kanban__list_tags
        mcp__vibe_kanban__add_issue_tag
      ].freeze

      def initialize(config)
        super
        tsukkomi_config = Tsukkomi.configuration
        @project_id = config[:project_id] || tsukkomi_config.vibe_kanban_project_id
        @project = config[:project] || tsukkomi_config.vibe_kanban_project
        unless claude_cli_available?
          raise "Claude Code CLI が見つかりません。vibe-kanban バックエンドには Claude Code CLI が必要です。"
        end
      end

      def submit_task(task, _feedback)
        prompt = build_prompt(task)

        Rails.logger.info("[tsukkomi/vibe-kanban] Submitting task: #{task[:title]}")
        start = Process.clock_gettime(Process::CLOCK_MONOTONIC)

        stdout, stderr, status = Open3.capture3(
          clean_env,
          "claude", "-p", "--output-format", "text",
          "--dangerously-skip-permissions",
          "--allowedTools", ALLOWED_TOOLS.join(","),
          stdin_data: prompt,
          chdir: Dir.home
        )

        elapsed = (Process.clock_gettime(Process::CLOCK_MONOTONIC) - start).round(1)
        Rails.logger.info("[tsukkomi/vibe-kanban] claude CLI responded (#{elapsed}s)")

        unless status.success?
          raise "claude CLI exited with code #{status.exitstatus}#{stderr.present? ? "\nstderr: #{stderr}" : ""}"
        end

        json_match = stdout.match(/\{[\s\S]*\}/)
        if json_match
          JSON.parse(json_match[0], symbolize_names: true)
        else
          { raw_output: stdout }
        end
      end

      private

      def build_prompt(task)
        if @project_id
          build_prompt_with_id(task)
        else
          build_prompt_with_lookup(task)
        end
      end

      def build_prompt_with_id(task)
        <<~PROMPT
          vibe-kanban の MCP ツールを使って、以下のタスクを Issue として登録してください。

          ## 手順

          1. create_issue で Issue を作成（project_id: "#{@project_id}"）
          2. list_tags で project_id "#{@project_id}" のタグ一覧を取得し、適切なタグがあれば add_issue_tag でタグ付け

          ## タスク情報

          - **タイトル**: #{task[:title]}
          - **説明**: #{task[:description]}
          - **カテゴリ**: #{task[:category]}
          - **優先度**: #{map_priority(task[:category])}

          ## 出力

          作成した Issue の情報を以下のJSON形式で出力してください。

          ```json
          {
            "issue_id": "作成されたIssueのID",
            "title": "タイトル",
            "status": "作成結果（success/error）"
          }
          ```
        PROMPT
      end

      def build_prompt_with_lookup(task)
        project_instruction = if @project
          "プロジェクト名が「#{@project}」と完全一致するプロジェクト"
        else
          "最初に見つかったプロジェクト"
        end

        <<~PROMPT
          vibe-kanban の MCP ツールを使って、以下のタスクを Issue として登録してください。

          ## 手順

          1. list_organizations で組織一覧を取得
          2. list_projects で#{project_instruction}を特定し、その project_id を使う
          3. create_issue で Issue を作成
          4. list_tags でタグ一覧を取得し、適切なタグがあれば add_issue_tag でタグ付け

          ## タスク情報

          - **タイトル**: #{task[:title]}
          - **説明**: #{task[:description]}
          - **カテゴリ**: #{task[:category]}
          - **優先度**: #{map_priority(task[:category])}

          ## 出力

          作成した Issue の情報を以下のJSON形式で出力してください。

          ```json
          {
            "issue_id": "作成されたIssueのID",
            "title": "タイトル",
            "status": "作成結果（success/error）"
          }
          ```
        PROMPT
      end

      def map_priority(category)
        case (category || "").downcase
        when "bug" then "high"
        when "improvement", "enhancement" then "medium"
        when "question" then "low"
        else "medium"
        end
      end

      def claude_cli_available?
        system(clean_env, "claude", "--version", out: File::NULL, err: File::NULL)
      end

      def clean_env
        kept_keys = %w[
          HOME USER SHELL PATH TERM LANG LC_ALL
          TMPDIR XDG_CONFIG_HOME XDG_DATA_HOME
          NODE_PATH NVM_DIR
          ANTHROPIC_API_KEY
        ]
        env = ENV.to_h.transform_values { |_| nil }
        kept_keys.each { |k| env[k] = ENV[k] if ENV.key?(k) }
        env
      end
    end
  end
end
