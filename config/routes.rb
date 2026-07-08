Tsukkomi::Engine.routes.draw do
  # Widget JS
  get "widget.js", to: "widget#show", as: :widget_js

  # API
  namespace :api do
    resources :feedbacks, only: [:index, :create] do
      member do
        get :status
        post :sync_backend
      end
    end
  end

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
end
