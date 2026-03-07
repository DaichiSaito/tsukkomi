# Tsukkomi - フィードバック収集ツール設定
#
# 使い方:
#   1. LLM モードを設定（下記参照）
#   2. バックエンド連携が必要なら backend / github_repo 等を設定
#   3. rails db:migrate を実行
#   4. ブラウザでアプリにアクセスすると右下にフィードバックボタンが表示されます
#   5. /tsukkomi/admin で管理画面にアクセスできます
#
# フィードバックの流れ:
#   ウィジェット → スクリーンショット撮影 → 範囲選択 → コメント入力
#   → AIがタスク生成（プレビュー表示） → 確認して登録
#   → DB保存 + バックエンド連携（GitHub Issues等、ON/OFF選択可）
#
Tsukkomi.configure do |config|
  # --------------------------------------------------------------------------
  # LLM設定
  # --------------------------------------------------------------------------
  # LLM モード（:api / :cli / :auto）
  #
  #   :api    — Anthropic API を使用（ANTHROPIC_API_KEY 必須）
  #             ステージング・本番など CLI が入っていない環境向け
  #   :cli    — Claude Code CLI を使用（claude コマンド必須、APIキー不要）
  #             ローカル開発環境向け
  #   :auto   — API キーがあれば :api、なければ CLI にフォールバック（デフォルト）
  #
  # 環境ごとの推奨設定:
  #   development: :cli（Claude Code がインストール済みならAPIキー不要）
  #   staging:     :api（CLI は通常インストールされていないため）
  #   production:  :api
  #
  config.llm_mode = :auto
  config.anthropic_api_key = ENV["ANTHROPIC_API_KEY"]

  # 使用するClaudeモデル（デフォルト: claude-sonnet-4-20250514）
  # config.claude_model = "claude-sonnet-4-20250514"

  # --------------------------------------------------------------------------
  # バックエンド連携（任意）
  # --------------------------------------------------------------------------
  # フィードバックから生成されたタスクを外部サービスに連携します。
  # 設定しない場合、タスクはDB保存のみ（管理画面から後で手動連携も可能）。
  #
  # ■ GitHub Issues に連携する場合
  #
  #   GitHub 認証モード（:token / :gh_cli / :auto）
  #
  #     :token  — Personal Access Token を使用（GITHUB_TOKEN 必須）
  #               ステージング・本番など gh CLI が入っていない環境向け
  #     :gh_cli — gh CLI を使用（`gh auth login` 済みであること）
  #               ローカル開発環境向け（トークン管理不要で手軽）
  #     :auto   — トークンがあれば :token、なければ gh CLI にフォールバック（デフォルト）
  #
  # config.backend = :github_issues
  # config.github_repo = "owner/repo"
  # config.github_auth_mode = :auto
  # config.github_token = ENV["GITHUB_TOKEN"]
  #
  # ■ vibe-kanban に連携する場合（Claude Code CLI + MCP 経由）
  #   事前設定: claude mcp add vibe-kanban -- npx -y vibe-kanban@latest --mcp
  #
  # config.backend = :vibe_kanban
  # config.vibe_kanban_project = "my-project"

  # --------------------------------------------------------------------------
  # ウィジェット設定
  # --------------------------------------------------------------------------
  # HTMLに自動でウィジェットの<script>タグを挿入します（デフォルト: true）
  # falseにした場合、手動で <script src="/tsukkomi/widget.js"> を追加してください。
  # config.auto_inject = true

  # フィードバック送信者の表示名（デフォルト: "anonymous"）
  # config.reporter = "anonymous"

  # --------------------------------------------------------------------------
  # タスク生成プロンプトのカスタマイズ（任意）
  # --------------------------------------------------------------------------
  # LLM に送るプロンプトをカスタマイズできます。
  #
  # 文字列を指定すると、デフォルトプロンプトの末尾に「追加指示」として付加されます:
  #   config.task_prompt = "タイトルは英語で出力してください"
  #
  # Proc を指定すると、プロンプト全体を自由に構築できます:
  #   config.task_prompt = ->(feedback, has_screenshot) {
  #     <<~PROMPT
  #       あなたはQAエンジニアです。
  #       以下のフィードバックを分析し、開発タスクをJSON形式で生成してください。
  #
  #       コメント: #{feedback[:comment]}
  #       ページURL: #{feedback[:page_url]}
  #
  #       {"title": "...", "category": "bug|improvement|question", "description": "...", "labels": [...]}
  #     PROMPT
  #   }
  # config.task_prompt = nil
end
