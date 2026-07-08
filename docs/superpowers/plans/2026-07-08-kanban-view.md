# カンバンビュー Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 管理画面に、解決状況（オープン/クローズ/やらない）を列とするカンバンビューを追加し、カードのドラッグ&ドロップで解決状況を変更できるようにする。

**Architecture:** `Tsukkomi::Admin::TasksController` に `board`（一覧をresolutionでグループ化）と `move`（DnDで解決状況を更新）の2アクションを追加。`board.html.erb` が3カラムを描画し、SortableJS(CDN)でDnD → `move` エンドポイントへ fetch POST。リスト表示は無変更で残し、トグルで相互切替。

**Tech Stack:** Rails Engine (ERB), Tailwind CSS (CDN), SortableJS (CDN), 素の fetch。

## Global Constraints

- 列軸は `resolution`。列順は必ず `open → closed → wontfix`（ラベル: オープン / クローズ / やらない）。
- DnDでの解決状況変更は既存の遷移メソッド経由: `closed→close!`, `wontfix→wontfix!`, `open→reopen!`。
- カードはテキストのみ: `#ID` ・タイトル・ステータスbadge・作成日時（`%Y-%m-%d %H:%M`）。カテゴリは載せない。
- CSRF: `ApplicationController` は `protect_from_forgery with: :null_session`。AJAX POSTにトークン不要。
- adminは Tailwind CDN（ビルド不要）。JSフレームワークなし。外部JSはCDNで読み込む。
- gemにテスト基盤なし → **検証はブラウザ/curl実機**。動作確認環境は tsukkomi を path gem 導入済みの `scs-star2`（`http://localhost:3000`）。
- **エンジンの `config/routes.rb` / コントローラを変更したら Rails dev サーバを再起動**（エンジンのルート/クラスは dev で自動リロードされない）。ビュー(.erb)はリロード不要。
- `move` エンドポイントの応答: 成功 `head :ok` / 不正resolution `head :unprocessable_entity`(422) / 不明ID は `RecordNotFound`(404)。
- YAGNI: カード並び順の永続化なし、列軸切替なし、サムネイルなし、ページネーションなし。

---

### Task 1: board ルート + board アクション + カンバンビュー（静的）+ トグル部分テンプレート

`/tsukkomi/admin/board` が解決状況ごとの3カラムでタスクを表示する（DnDはまだ無し）。

**Files:**
- Modify: `config/routes.rb`
- Modify: `app/controllers/tsukkomi/admin/tasks_controller.rb`
- Create: `app/views/tsukkomi/admin/tasks/_view_toggle.html.erb`
- Create: `app/views/tsukkomi/admin/tasks/board.html.erb`

**Interfaces:**
- Produces:
  - ルートヘルパ `board_admin_tasks_path`（GET）と `move_admin_task_path(task)`（POST, 次タスクで使用）
  - `#board` アクションが `@tasks_by_resolution = { "open" => [...], "closed" => [...], "wontfix" => [...] }`（Hash, resolution文字列 => Task配列）を設定
  - 部分テンプレート `_view_toggle`（local `active:` に `:list` / `:board`）
  - カードDOM: `[data-task-id]` と `[data-move-url]`、カラム: `[data-resolution]`、件数バッジ: `[data-count]`、空表示: `[data-empty]`（Task 3 のJSが参照）

- [ ] **Step 1: ルートに `board`(collection) を追加**（`move` も同時に追加）

`config/routes.rb` の admin ブロックを次の内容に置き換える:

```ruby
  # Admin
  namespace :admin do
    resources :tasks, only: [:index, :show, :update, :destroy] do
      member do
        post :sync_to_backend
        post :close
        post :wontfix
        post :reopen
        post :move
      end
      collection do
        get :board
      end
    end
    root to: "tasks#index"
  end
```

- [ ] **Step 2: `#board` アクションを追加**

`app/controllers/tsukkomi/admin/tasks_controller.rb` の `index` アクションの直後に追加:

```ruby
      def board
        @tasks_by_resolution = Tsukkomi::Task.includes(:feedback).recent.group_by(&:resolution)
      end
```

- [ ] **Step 3: トグル部分テンプレートを作成**

`app/views/tsukkomi/admin/tasks/_view_toggle.html.erb`:

```erb
<%# local: active (:list | :board) %>
<div class="inline-flex rounded-md border border-gray-300 overflow-hidden text-sm">
  <%= link_to "リスト", tsukkomi.admin_tasks_path,
        class: "px-3 py-1.5 #{active == :list ? "bg-gray-900 text-white" : "bg-white text-gray-700 hover:bg-gray-100"}" %>
  <%= link_to "カンバン", tsukkomi.board_admin_tasks_path,
        class: "px-3 py-1.5 border-l border-gray-300 #{active == :board ? "bg-gray-900 text-white" : "bg-white text-gray-700 hover:bg-gray-100"}" %>
</div>
```

- [ ] **Step 4: カンバンビュー（静的）を作成**

`app/views/tsukkomi/admin/tasks/board.html.erb`:

```erb
<div class="mb-6 flex items-center justify-between">
  <h1 class="text-2xl font-bold text-gray-900">タスク一覧</h1>
  <%= render "view_toggle", active: :board %>
</div>

<%
  columns = [
    { key: "open",    label: "オープン", color: "bg-green-100 text-green-800" },
    { key: "closed",  label: "クローズ", color: "bg-gray-100 text-gray-800" },
    { key: "wontfix", label: "やらない", color: "bg-orange-100 text-orange-800" },
  ]
  status_colors = {
    "processing" => "bg-amber-100 text-amber-800",
    "generated"  => "bg-blue-100 text-blue-800",
    "pending"    => "bg-yellow-100 text-yellow-800",
    "synced"     => "bg-green-100 text-green-800",
    "failed"     => "bg-red-100 text-red-800",
  }
%>

<div class="grid grid-cols-3 gap-4">
  <% columns.each do |col| %>
    <% tasks = @tasks_by_resolution.fetch(col[:key], []) %>
    <div class="bg-gray-100 rounded-lg p-3">
      <div class="flex items-center justify-between mb-3">
        <span class="inline-flex px-2 py-0.5 rounded text-xs font-medium <%= col[:color] %>"><%= col[:label] %></span>
        <span class="text-xs text-gray-500" data-count><%= tasks.size %></span>
      </div>
      <div class="space-y-2 min-h-[120px]" data-resolution="<%= col[:key] %>">
        <% tasks.each do |task| %>
          <div onclick="location.href='<%= tsukkomi.admin_task_path(task) %>'"
               class="bg-white rounded-md border border-gray-200 p-3 shadow-sm hover:shadow cursor-pointer transition"
               data-task-id="<%= task.id %>"
               data-move-url="<%= tsukkomi.move_admin_task_path(task) %>">
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs text-gray-400">#<%= task.id %></span>
              <span class="inline-flex px-2 py-0.5 rounded text-xs font-medium <%= status_colors[task.status] %>"><%= task.status %></span>
            </div>
            <p class="text-sm font-medium text-gray-900 mb-1"><%= task.title %></p>
            <p class="text-xs text-gray-400"><%= task.created_at.strftime("%Y-%m-%d %H:%M") %></p>
          </div>
        <% end %>
        <p class="text-xs text-gray-400 text-center py-6 <%= "hidden" unless tasks.empty? %>" data-empty>ここにドロップ</p>
      </div>
    </div>
  <% end %>
</div>
```

- [ ] **Step 5: Rails dev サーバを再起動**（ルート/コントローラ変更のため）

```bash
pkill -f "rails s" 2>/dev/null; sleep 1
cd /Users/daichisaito/works/own/scs-star2 && (bin/rails s -p 3000 >/tmp/rails-kanban.log 2>&1 &)
sleep 5 && curl -s -o /dev/null -w "up %{http_code}\n" http://localhost:3000/up
```
Expected: `up 200`

- [ ] **Step 6: テストデータを用意**（既にタスクがあればスキップ可）

```bash
cd /Users/daichisaito/works/own/scs-star2 && bin/rails runner '
%w[open closed wontfix].each_with_index do |r,i|
  fb = Tsukkomi::Feedback.create!(comment: "kanban確認#{i}", reporter: "anonymous", page_url: "/x")
  Tsukkomi::Task.create!(feedback: fb, title: "カンバン確認タスク#{i}", category: "bug", status: "generated", resolution: r)
end
puts "tasks=#{Tsukkomi::Task.count}"
'
```
Expected: `tasks=` が3以上。

- [ ] **Step 7: ブラウザ/curl で3カラム表示を確認**

```bash
curl -s "http://localhost:3000/tsukkomi/admin/board" > /tmp/board.html
grep -c 'data-resolution=' /tmp/board.html   # => 3
grep -o 'オープン\|クローズ\|やらない' /tmp/board.html | sort -u   # => 3ラベル
grep -c 'data-task-id=' /tmp/board.html       # => タスク件数
```
Expected: `data-resolution` が3、ラベル3種、`data-task-id` がタスク数ぶん。
さらにブラウザで `http://localhost:3000/tsukkomi/admin/board` を開き、3カラムにカードが解決状況どおり並び、右上トグルの「カンバン」がアクティブ、「リスト」クリックで `/tsukkomi/admin` に戻ることを目視確認。

- [ ] **Step 8: コミット**

```bash
cd /Users/daichisaito/hobbies/tsukkomi
git add config/routes.rb app/controllers/tsukkomi/admin/tasks_controller.rb \
        app/views/tsukkomi/admin/tasks/_view_toggle.html.erb \
        app/views/tsukkomi/admin/tasks/board.html.erb
git commit -m "feat: 管理画面にカンバンビュー(board)を追加（静的表示）"
```

---

### Task 2: move ルート + move アクション

DnDの永続化先となる `POST /tsukkomi/admin/tasks/:id/move` を実装する（ルートは Task 1 で追加済み。ここでアクションを実装）。

**Files:**
- Modify: `app/controllers/tsukkomi/admin/tasks_controller.rb`

**Interfaces:**
- Consumes: ルート `move_admin_task_path(task)`（Task 1）
- Produces: `#move` — body `{ "resolution": "open"|"closed"|"wontfix" }` を受け、対応する遷移メソッドを呼び `head :ok`。不正値は `head :unprocessable_entity`。

- [ ] **Step 1: `#move` アクションを追加**

`app/controllers/tsukkomi/admin/tasks_controller.rb` の `board` アクションの直後に追加:

```ruby
      def move
        @task = Tsukkomi::Task.find(params[:id])
        case params[:resolution]
        when "closed"  then @task.close!
        when "wontfix" then @task.wontfix!
        when "open"    then @task.reopen!
        else
          return head :unprocessable_entity
        end
        head :ok
      end
```

- [ ] **Step 2: Rails dev サーバを再起動**（コントローラ変更のため）

```bash
pkill -f "rails s" 2>/dev/null; sleep 1
cd /Users/daichisaito/works/own/scs-star2 && (bin/rails s -p 3000 >/tmp/rails-kanban.log 2>&1 &)
sleep 5 && curl -s -o /dev/null -w "up %{http_code}\n" http://localhost:3000/up
```
Expected: `up 200`

- [ ] **Step 3: curl で move の挙動を確認**

```bash
cd /Users/daichisaito/works/own/scs-star2
TID=$(bin/rails runner 'print Tsukkomi::Task.where(resolution: "open").first&.id || Tsukkomi::Task.first&.id')
echo "task=$TID"
# closed に移動 → 200
curl -s -o /dev/null -w "closed=%{http_code}\n" -X POST "http://localhost:3000/tsukkomi/admin/tasks/$TID/move" \
  -H 'Content-Type: application/json' -d '{"resolution":"closed"}'
# 永続化確認: resolution=closed, closed_at がセットされる
bin/rails runner "t=Tsukkomi::Task.find($TID); puts [t.resolution, t.closed_at.present?].inspect"
# 不正値 → 422
curl -s -o /dev/null -w "bogus=%{http_code}\n" -X POST "http://localhost:3000/tsukkomi/admin/tasks/$TID/move" \
  -H 'Content-Type: application/json' -d '{"resolution":"bogus"}'
# open に戻す（後片付け）→ closed_at が nil に戻る
curl -s -o /dev/null -w "open=%{http_code}\n" -X POST "http://localhost:3000/tsukkomi/admin/tasks/$TID/move" \
  -H 'Content-Type: application/json' -d '{"resolution":"open"}'
bin/rails runner "t=Tsukkomi::Task.find($TID); puts [t.resolution, t.closed_at.nil?].inspect"
```
Expected: `closed=200`、`[\"closed\", true]`、`bogus=422`、`open=200`、`[\"open\", true]`。

- [ ] **Step 4: コミット**

```bash
cd /Users/daichisaito/hobbies/tsukkomi
git add app/controllers/tsukkomi/admin/tasks_controller.rb
git commit -m "feat: カンバンのDnD永続化用 move アクションを追加"
```

---

### Task 3: DnD 配線（SortableJS + fetch）

カードを別カラムへドラッグすると `move` を呼び、解決状況が永続化される。

**Files:**
- Modify: `app/views/tsukkomi/admin/tasks/board.html.erb`

**Interfaces:**
- Consumes: `[data-resolution]` / `[data-task-id]` / `[data-move-url]` / `[data-count]` / `[data-empty]`（Task 1）、`move` エンドポイント（Task 2）

- [ ] **Step 1: board.html.erb の末尾に SortableJS 読み込みと初期化スクリプトを追記**

`board.html.erb` の最後（最後の `</div>` の後）に以下を追加:

```erb
<script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/Sortable.min.js"></script>
<script>
  (function () {
    if (typeof Sortable === 'undefined') return;

    function updateCounts() {
      document.querySelectorAll('[data-resolution]').forEach(function (list) {
        var count = list.querySelectorAll('[data-task-id]').length;
        var badge = list.parentElement.querySelector('[data-count]');
        if (badge) badge.textContent = count;
        var empty = list.querySelector('[data-empty]');
        if (empty) empty.classList.toggle('hidden', count !== 0);
      });
    }

    document.querySelectorAll('[data-resolution]').forEach(function (list) {
      new Sortable(list, {
        group: 'tsukkomi-tasks',
        draggable: '[data-task-id]',
        animation: 150,
        onEnd: function (evt) {
          var newResolution = evt.to.getAttribute('data-resolution');
          var oldResolution = evt.from.getAttribute('data-resolution');
          updateCounts();
          if (newResolution === oldResolution) return;
          var url = evt.item.getAttribute('data-move-url');
          fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resolution: newResolution })
          }).then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
          }).catch(function (err) {
            console.error('[tsukkomi] move failed:', err);
            alert('解決状況の変更に失敗しました。ページを再読み込みします。');
            location.reload();
          });
        }
      });
    });

    updateCounts();
  })();
</script>
```

- [ ] **Step 2: ブラウザでDnDと永続化を確認**（ビューのみ変更なのでサーバ再起動不要）

`http://localhost:3000/tsukkomi/admin/board` を開き、chrome-devtools の drag もしくは手動で、「オープン」列のカードを「クローズ」列へドラッグ&ドロップする。確認項目:
1. カードがクローズ列へ移動し、各列の件数バッジが更新される。
2. ページを再読み込みしても、そのカードがクローズ列に残る（永続化）。
3. 対象タスクの `closed_at` がセットされている:
```bash
cd /Users/daichisaito/works/own/scs-star2 && bin/rails runner 'puts Tsukkomi::Task.where(resolution: "closed").order(:updated_at).last&.closed_at.inspect'
```
Expected: 時刻が表示される（nilでない）。
4. カードクリック（ドラッグでない）で詳細ページに遷移する。

- [ ] **Step 3: コミット**

```bash
cd /Users/daichisaito/hobbies/tsukkomi
git add app/views/tsukkomi/admin/tasks/board.html.erb
git commit -m "feat: カンバンにドラッグ&ドロップ(SortableJS)を実装し解決状況を永続化"
```

---

### Task 4: リスト側にトグルを追加（相互切替の完成）

リスト表示からカンバンへ遷移できるよう、`index.html.erb` にトグルを置く。

**Files:**
- Modify: `app/views/tsukkomi/admin/tasks/index.html.erb`

**Interfaces:**
- Consumes: 部分テンプレート `_view_toggle`（Task 1）

- [ ] **Step 1: index.html.erb の見出しをトグル付きに変更**

先頭の見出しブロックを置き換える。

置換前:
```erb
<div class="mb-6">
  <h1 class="text-2xl font-bold text-gray-900">タスク一覧</h1>
</div>
```

置換後:
```erb
<div class="mb-6 flex items-center justify-between">
  <h1 class="text-2xl font-bold text-gray-900">タスク一覧</h1>
  <%= render "view_toggle", active: :list %>
</div>
```

- [ ] **Step 2: ブラウザで相互切替を確認**（ビューのみ変更、再起動不要）

`http://localhost:3000/tsukkomi/admin` を開き:
1. 右上に「リスト / カンバン」トグルがあり「リスト」がアクティブ。
2. 「カンバン」クリックで `/tsukkomi/admin/board` に遷移し、そちらでは「カンバン」がアクティブ。
3. カンバンの「リスト」クリックで一覧に戻る。

- [ ] **Step 3: コミット**

```bash
cd /Users/daichisaito/hobbies/tsukkomi
git add app/views/tsukkomi/admin/tasks/index.html.erb
git commit -m "feat: タスク一覧にリスト/カンバン切替トグルを追加"
```

---

## 完了後

- 4タスクのコミットはローカル `main`。前回同様、動作確認後にユーザー確認のうえ `git push origin main`。
- 後片付け: 検証用に作成したテストデータを削除する場合:
```bash
cd /Users/daichisaito/works/own/scs-star2 && bin/rails runner 'Tsukkomi::Feedback.where("comment LIKE ?", "kanban確認%").destroy_all; puts "cleaned"'
```
