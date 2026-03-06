# Tsukkomi

開発環境専用のフィードバック収集 Rails Engine gem。

ブラウザ上のウィジェットからスクリーンショット付きフィードバックを送信すると、Claude (LLM) が構造化タスクに変換し、DB に保存します。オプションで GitHub Issues への連携も可能です。

## 特徴

- **ウィジェット** — Rack middleware でアプリの全ページに自動注入。Shadow DOM でスタイル隔離
- **スクリーンショット** — SVG foreignObject でキャプチャ、範囲選択、ActiveStorage で保存
- **LLM タスク生成** — Anthropic API (Claude) でフィードバックを `{title, category, description, labels}` に構造化
- **プレビュー確認** — AI 生成結果を送信前にプレビュー。バックエンド連携の ON/OFF をその場で選択
- **管理画面** — `/tsukkomi/admin` でタスク一覧・詳細・手動バックエンド連携
- **GitHub Issues 連携** — token または `gh` CLI 認証。スクリーンショットも自動アップロード

## セットアップ

### 1. Gemfile に追加

```ruby
gem "tsukkomi", path: "path/to/tsukkomi", group: :development
```

### 2. インストール

```bash
rails g tsukkomi:install
rails db:migrate
```

以下が生成されます:

- `db/migrate/xxx_create_tsukkomi_feedbacks.rb`
- `db/migrate/xxx_create_tsukkomi_tasks.rb`
- `config/initializers/tsukkomi.rb`
- `config/routes.rb` に Engine マウント追加

### 3. 設定

```ruby
# config/initializers/tsukkomi.rb
Tsukkomi.configure do |config|
  # LLM設定（必須）
  config.anthropic_api_key = ENV["ANTHROPIC_API_KEY"]
  # config.claude_model = "claude-sonnet-4-20250514"

  # バックエンド連携（任意）
  # config.backend = :github_issues
  # config.github_repo = "owner/repo"
  # config.github_token = ENV["GITHUB_TOKEN"]  # 未設定なら gh CLI を使用

  # ウィジェット自動注入（デフォルト: true）
  # config.auto_inject = true

  # レポーター名（デフォルト: "anonymous"）
  # config.reporter = "anonymous"

  # タスク生成プロンプトのカスタマイズ
  # 文字列: デフォルトプロンプトに追加指示として付加
  # config.task_prompt = "タイトルは英語で出力してください"
  # Proc: プロンプト全体を自由に構築
  # config.task_prompt = ->(feedback, has_screenshot) {
  #   <<~PROMPT
  #     あなたはQAエンジニアです。
  #     コメント: #{feedback[:comment]}
  #     ...
  #   PROMPT
  # }
end
```

### 4. 使う

Rails サーバーを起動してアプリにアクセスすると、右下にフィードバックボタンが表示されます。

1. ボタンをクリック（またはCmd+Shift+F）
2. スクリーンショットが自動取得される
3. ドラッグで範囲選択
4. コメントを入力して送信
5. AI がタスクを生成、プレビューを確認して登録

## ルーティング

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/tsukkomi/widget.js` | ウィジェット JS 配信 |
| GET | `/tsukkomi/api/feedbacks` | フィードバック履歴 |
| POST | `/tsukkomi/api/feedbacks` | フィードバック受付 |
| POST | `/tsukkomi/api/feedbacks/preview` | LLM プレビュー生成 |
| POST | `/tsukkomi/api/feedbacks/confirm` | 確認・バックエンド連携 |
| GET | `/tsukkomi/api/feedbacks/:id/status` | SSE 進捗 |
| GET | `/tsukkomi/admin` | タスク一覧（管理画面） |
| GET | `/tsukkomi/admin/tasks/:id` | タスク詳細 |
| POST | `/tsukkomi/admin/tasks/:id/sync_to_backend` | 手動バックエンド連携 |

## 動作要件

- Ruby 3.1+
- Rails 7.0+
- ActiveStorage（スクリーンショット保存用）
- `ANTHROPIC_API_KEY`（LLM タスク生成用）

## ライセンス

MIT
