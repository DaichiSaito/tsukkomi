module Tsukkomi
  class Engine < ::Rails::Engine
    isolate_namespace Tsukkomi

    initializer "tsukkomi.middleware" do |app|
      if Tsukkomi.configuration.auto_inject
        require "tsukkomi/middleware/widget_injector"
        app.middleware.use Tsukkomi::Middleware::WidgetInjector
      end
    end

    config.after_initialize do
      config = Tsukkomi.configuration
      if config.backend.present?
        backend_name = config.backend.to_s
        backend_config = case config.backend.to_sym
          when :github_issues
            { repo: config.github_repo, token: config.github_token }
          else
            {}
          end

        require "tsukkomi/backends/registry"
        Tsukkomi::Backends::Registry.initialize_backends(
          [backend_name],
          { backend_name => backend_config }
        )
      end
    end
  end
end
