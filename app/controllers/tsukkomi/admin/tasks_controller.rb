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

        unless Tsukkomi.configuration.backend.present?
          redirect_to admin_task_path(@task), alert: "バックエンドが設定されていません"
          return
        end

        Tsukkomi::SyncToBackendJob.perform_later(@task.id)
        redirect_to admin_task_path(@task), notice: "バックエンド連携を開始しました"
      end
    end
  end
end
