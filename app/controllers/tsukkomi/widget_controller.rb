module Tsukkomi
  class WidgetController < ApplicationController
    skip_forgery_protection

    def show
      widget_path = File.expand_path("../../assets/builds/tsukkomi/widget.bundle.js", __dir__)
      if File.exist?(widget_path)
        send_file widget_path, type: "application/javascript", disposition: "inline"
      else
        render plain: "// widget.bundle.js not found. Run: rake tsukkomi:build_widget", content_type: "application/javascript"
      end
    end
  end
end
