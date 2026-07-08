# カンバンビュー 設計

- 日付: 2026-07-08
- 対象: `tsukkomi` gem の管理画面（`/tsukkomi/admin`）

## 背景・目的

現状の管理画面はタスクの**リスト表示**のみ。解決状況（オープン／クローズ／やらない）を
視覚的に把握し、ドラッグ&ドロップで手早くトリアージできる**カンバンビューも追加**する。
リスト表示は従来どおり残し、両者を切り替えられるようにする。

## 決定事項

| 項目 | 決定 |
|------|------|
| 列（レーン）の軸 | **解決状況** `resolution`（open / closed / wontfix）の3列 |
| カード操作 | **ドラッグ&ドロップ**で別レーンへ移動 → 解決状況を変更 |
| カード内容 | **テキストのみ**（ID・タイトル・ステータスbadge・作成日時） |
| リストとの関係 | 追加。リストは無変更で残し、トグルで相互に切替 |

`status`（processing/generated/pending/synced/failed）は列軸に使わない（AI生成・連携の
処理段階であり自動遷移が多いため）。カードには参考情報として status バッジは表示する。

## アーキテクチャ

### ルート（`config/routes.rb`）

```ruby
namespace :admin do
  resources :tasks, only: [:index, :show, :update, :destroy] do
    member do
      post :sync_to_backend
      post :close
      post :wontfix
      post :reopen
      post :move        # 追加: DnDで解決状況を変更
    end
    collection do
      get :board        # 追加: カンバンビュー
    end
  end
  root to: "tasks#index"
end
```

### コントローラ（`Tsukkomi::Admin::TasksController`）

- `#board`
  - `@tasks_by_resolution = Tsukkomi::Task.includes(:feedback).recent.group_by(&:resolution)`
  - 表示順は `open → closed → wontfix` 固定。該当なしの解決状況は空カラムとして表示。
- `#move`
  - `params[:resolution]` により遷移メソッドを呼ぶ:
    - `"closed"` → `task.close!`
    - `"wontfix"` → `task.wontfix!`
    - `"open"` → `task.reopen!`
    - それ以外 → `head :unprocessable_entity`
  - 成功時は `head :ok`（リダイレクトしない。AJAX前提）
  - `Tsukkomi::Task::RESOLUTIONS` で値を検証してから遷移する。

CSRF: `ApplicationController` は `protect_from_forgery with: :null_session` のため、
AJAX POST にトークンは不要（admin はセッション非依存）。

### ビュー（`app/views/tsukkomi/admin/tasks/board.html.erb`）

- 見出し「タスク一覧」＋「リスト / カンバン」トグル（後述）。
- 3カラムを `grid grid-cols-3 gap-4` で配置。各カラム:
  - ヘッダ = 解決状況ラベル（オープン/クローズ/やらない）＋件数バッジ。既存の
    `resolution_colors` / `resolution_labels` の配色を踏襲。
  - ドロップ領域 = カラムのコンテナ。`data-resolution="open|closed|wontfix"` を持たせる。
  - カード = `data-task-id` を持つ要素。ID・タイトル・ステータスbadge・作成日時。
    クリックで詳細（`admin_task_path`）へ遷移。
  - 空カラムは薄いプレースホルダ（例: 「ここにドロップ」）を表示。
- ページネーションなし（全件をカラムへ配置）。

### トグル（リスト ⇄ カンバン）

- リスト（`index`）とカンバン（`board`）双方の見出し付近にセグメント型リンクを置く。
  - リスト → `tsukkomi.admin_tasks_path`
  - カンバン → `tsukkomi.board_admin_tasks_path`
  - 現在ビューをアクティブ表示。

### ドラッグ&ドロップ + 永続化

- カンバンビューでのみ **SortableJS（CDN）** を読み込む（既存の Tailwind CDN と同流儀）。
  読み込みは `board.html.erb` 内に限定し、リスト等には影響させない。
- 各カラムのドロップ領域を共有グループ（例 `group: "tsukkomi-tasks"`）で Sortable 化。
- `onEnd` ハンドラ:
  1. 移動先カラムの `data-resolution` と、カードの `data-task-id` を取得。
  2. 同一カラム内移動（解決状況が変わらない）なら何もしない。
  3. `fetch("/tsukkomi/admin/tasks/#{id}/move", { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ resolution }) })`。
  4. 失敗（非2xx / 例外）時はカードを元のカラムへ戻し、簡易メッセージを表示。
  5. 成功時はカラムの件数バッジを更新。
- API ベースは注入時の設定に依存せず、`admin` 配下の相対パスで組み立てる
  （ビューで `tsukkomi.move_admin_task_path(task)` を各カードの `data-move-url` に埋めておき、
  JS はそれを使う → マウント位置が `/tsukkomi` 以外でも動く）。

## エラー処理・エッジケース

- 不正な `resolution` 値 → `#move` は `422` を返し、JS はカードを差し戻す。
- 存在しないタスクID → `find` が `RecordNotFound`（404）。JS は差し戻し。
- 同一レーン内の並べ替え → 永続化しない（順序は保存しない。YAGNI）。
- タスク大量時 → 全件描画で重くなりうるが dev 用途のため許容（将来必要なら列ごと遅延/制限）。

## 非目標（YAGNI）

- カード内の並び順の永続化。
- カラム軸の切替（status⇄resolution）。
- スクリーンショットサムネイルのカード表示。
- リアルタイム同期（複数タブ間）。

## 検証方針

gem にテスト基盤が無いため、**ブラウザ実機で検証**する:

1. `/tsukkomi/admin/board` で3カラム表示・件数・トグルを確認。
2. カードを別カラムへドラッグ → 解決状況が変わり、`closed_at` が適切に設定/クリアされる。
3. ページをリロードしても移動が維持される（永続化確認）。
4. リスト ⇄ カンバンのトグルが双方向で動く。
5. 既存のリスト表示・詳細・解決状況ボタンが無変更で動作すること（回帰確認）。
