module Tsukkomi
  module Middleware
    class WidgetInjector
      def initialize(app)
        @app = app
      end

      def call(env)
        status, headers, response = @app.call(env)

        content_type = headers["Content-Type"].to_s
        return [status, headers, response] unless content_type.include?("text/html")

        body = ""
        response.each { |part| body << part }
        response.close if response.respond_to?(:close)

        reporter = Tsukkomi.configuration.reporter || "anonymous"
        script_tag = %(<script src="/tsukkomi/widget.js" data-api-base="/tsukkomi" data-reporter="#{reporter}" data-confirm-before-submit="true"></script>)

        if body.include?("</body>")
          body = body.sub("</body>", "#{script_tag}\n</body>")
        elsif body.include?("</html>")
          body = body.sub("</html>", "#{script_tag}\n</html>")
        else
          body += script_tag
        end

        headers["Content-Length"] = body.bytesize.to_s
        [status, headers, [body]]
      end
    end
  end
end
