module Tsukkomi
  class Engine < ::Rails::Engine
    isolate_namespace Tsukkomi

    initializer "tsukkomi.middleware" do |app|
      if Tsukkomi.configuration.auto_inject
        require "tsukkomi/middleware/widget_injector"
        app.middleware.use Tsukkomi::Middleware::WidgetInjector
      end
    end
  end
end
