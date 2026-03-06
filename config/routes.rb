Tsukkomi::Engine.routes.draw do
  # Widget JS
  get "widget.js", to: "widget#show", as: :widget_js

  # API
  namespace :api do
    resources :feedbacks, only: [:index, :create] do
      collection do
        post :preview
        post :confirm
      end
      member do
        get :status
      end
    end
  end

  # Admin
  namespace :admin do
    resources :tasks, only: [:index, :show] do
      member do
        post :sync_to_backend
      end
    end
    root to: "tasks#index"
  end
end
