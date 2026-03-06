module Tsukkomi
  module Admin
    class TasksController < Tsukkomi::ApplicationController
      def index
        @tasks = Tsukkomi::Task.includes(:feedback)
                   .by_status(params[:status])
                   .by_category(params[:category])
                   .search(params[:q])
                   .recent

        # Simple pagination
        @page = [params[:page].to_i, 1].max
        @per_page = 20
        @total = @tasks.count
        @tasks = @tasks.offset((@page - 1) * @per_page).limit(@per_page)
      end

      def show
        @task = Tsukkomi::Task.includes(:feedback).find(params[:id])
      end

      def sync_to_backend
        @task = Tsukkomi::Task.includes(:feedback).find(params[:id])
        feedback = @task.feedback

        begin
          config = Tsukkomi.configuration
          backend_name = config.backend&.to_s

          unless backend_name
            redirect_to admin_task_path(@task), alert: "バックエンドが設定されていません"
            return
          end

          require "tsukkomi/backends/registry"
          Tsukkomi::Backends::Registry.initialize_backends(
            [backend_name],
            { backend_name => build_backend_config(config) }
          )

          task_data = { title: @task.title, category: @task.category, description: @task.description, labels: @task.labels }
          feedback_data = build_feedback_data(feedback)
          result = Tsukkomi::Backends::Registry.submit_to_all(task_data, feedback_data)

          @task.update!(
            status: result[:any_succeeded] ? "synced" : "failed",
            backend_results: result[:results],
            synced_at: result[:any_succeeded] ? Time.current : nil
          )

          if result[:any_succeeded]
            redirect_to admin_task_path(@task), notice: "バックエンドに連携しました"
          else
            redirect_to admin_task_path(@task), alert: "バックエンド連携に失敗しました"
          end
        rescue => e
          redirect_to admin_task_path(@task), alert: "エラー: #{e.message}"
        end
      end

      private

      def build_backend_config(config)
        case config.backend&.to_sym
        when :github_issues
          { repo: config.github_repo, token: config.github_token }
        when :vibe_kanban
          { project: config.vibe_kanban_project, project_id: config.vibe_kanban_project_id }
        else
          {}
        end
      end

      def build_feedback_data(feedback)
        {
          comment: feedback.comment,
          page_url: feedback.page_url,
          selector: feedback.selector,
          browser: feedback.browser,
          viewport: feedback.viewport
        }
      end
    end
  end
end
