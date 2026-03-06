# Tsukkomi - フィードバック収集ツール設定
#
# 使い方:
#   1. ANTHROPIC_API_KEY を設定（必須）
#   2. バックエンド連携が必要なら backend / github_repo / github_token を設定
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
  # LLM設定（必須）
  # --------------------------------------------------------------------------
  # Anthropic API キー。フィードバックからタスクを自動生成するのに使います。
  # 環境変数 ANTHROPIC_API_KEY を設定するか、ここに直接指定してください。
  config.anthropic_api_key = ENV["ANTHROPIC_API_KEY"]

  # 使用するClaudeモデル（デフォルト: claude-sonnet-4-20250514）
  # config.claude_model = "claude-sonnet-4-20250514"

  # --------------------------------------------------------------------------
  # バックエンド連携（任意）
  # --------------------------------------------------------------------------
  # フィードバックから生成されたタスクを外部サービスに連携します。
  # 設定しない場合、タスクはDB保存のみ（管理画面から後で手動連携も可能）。
  #
  # GitHub Issues に連携する場合:
  #   config.backend = :github_issues
  #   config.github_repo = "owner/repo"          # 例: "DaichiSaito/my-app"
  #   config.github_token = ENV["GITHUB_TOKEN"]   # Personal Access Token
  #
  # トークン未設定でも gh CLI がログイン済みなら自動でそちらを使います。
  # config.backend = :github_issues
  # config.github_repo = "owner/repo"
  # config.github_token = ENV["GITHUB_TOKEN"]

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
