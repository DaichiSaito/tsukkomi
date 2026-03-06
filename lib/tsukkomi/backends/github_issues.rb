# frozen_string_literal: true

require "net/http"
require "uri"
require "json"
require "digest"
require "open3"

module Tsukkomi
  module Backends
    class GithubIssues < Base
      CATEGORY_LABELS = {
        "bug" => "bug",
        "improvement" => "enhancement",
        "enhancement" => "enhancement",
        "question" => "question"
      }.freeze

      def initialize(config)
        super
        repo_str = config[:repo]
        raise "github_issues: repo is required (owner/repo)" unless repo_str

        parts = repo_str.split("/")
        raise "github_issues: repo must be in owner/repo format" unless parts.length == 2

        @owner = parts[0]
        @repo = parts[1]
        @token = config[:token]

        if @token
          @mode = :token
        elsif gh_cli_available?
          @mode = :gh
        else
          raise "github_issues: authentication required. Either provide :token or run `gh auth login` first."
        end
      end

      def submit_task(task, feedback)
        screenshot_url = upload_screenshot(feedback[:screenshot])
        body = build_issue_body(task, feedback, screenshot_url)

        label = CATEGORY_LABELS[(task[:category] || "").downcase]
        labels = label ? [label] : []

        issue = request("POST", "/repos/#{@owner}/#{@repo}/issues", {
          title: task[:title],
          body: body,
          labels: labels
        })

        { issue_number: issue["number"], url: issue["html_url"] }
      end

      private

      def gh_cli_available?
        system("gh", "auth", "status", out: File::NULL, err: File::NULL)
      end

      def request(method, path, body = nil)
        if @mode == :gh
          gh_api(method, path, body)
        else
          github_api(method, path, body)
        end
      end

      def github_api(method, path, body = nil)
        uri = URI("https://api.github.com#{path}")
        http = Net::HTTP.new(uri.host, uri.port)
        http.use_ssl = true

        request_class = case method
        when "GET" then Net::HTTP::Get
        when "POST" then Net::HTTP::Post
        when "PUT" then Net::HTTP::Put
        when "DELETE" then Net::HTTP::Delete
        else raise "Unsupported HTTP method: #{method}"
        end

        req = request_class.new(uri.path)
        req["Authorization"] = "token #{@token}"
        req["Accept"] = "application/vnd.github.v3+json"
        req["User-Agent"] = "tsukkomi"
        req["Content-Type"] = "application/json"
        req.body = JSON.generate(body) if body

        res = http.request(req)
        parsed = JSON.parse(res.body)

        if res.code.to_i >= 400
          raise "GitHub API #{res.code}: #{parsed['message'] || res.body}"
        end

        parsed
      end

      def gh_api(method, path, body = nil)
        args = ["gh", "api", path]
        args.push("-X", method) unless method == "GET"
        args.push("--input", "-") if body

        stdin_data = body ? JSON.generate(body) : nil
        stdout, stderr, status = Open3.capture3(*args, stdin_data: stdin_data)

        unless status.success?
          raise "gh api failed (exit #{status.exitstatus}): #{stderr.strip}"
        end

        JSON.parse(stdout)
      rescue JSON::ParserError
        raise "gh api: invalid JSON response: #{stdout[0, 200]}"
      end

      def upload_screenshot(screenshot_data_url)
        return nil unless screenshot_data_url

        match = screenshot_data_url.match(/\Adata:image\/([\w+]+);base64,(.+)\z/)
        return nil unless match

        ext = match[1] == "jpeg" ? "jpg" : match[1]
        base64_content = match[2]
        hash = Digest::MD5.hexdigest(base64_content[0, 1000])[0, 8]
        filename = "#{Time.now.to_i}-#{hash}.#{ext}"
        file_path = ".github/feedback-screenshots/#{filename}"

        begin
          result = request("PUT", "/repos/#{@owner}/#{@repo}/contents/#{file_path}", {
            message: "feedback: upload screenshot #{filename}",
            content: base64_content
          })
          result.dig("content", "download_url")
        rescue => e
          Rails.logger.warn("[github_issues] Screenshot upload failed: #{e.message}")
          nil
        end
      end

      def build_issue_body(task, feedback, screenshot_url)
        lines = []
        lines << (task[:description] || "")
        lines << ""

        if screenshot_url
          lines << "## Screenshot"
          lines << "![screenshot](#{screenshot_url})"
          lines << ""
        end

        lines << "## Metadata"
        lines << "- **URL**: #{feedback[:page_url]}" if feedback[:page_url]
        lines << "- **Reporter**: #{feedback[:reporter]}" if feedback[:reporter]
        lines << "- **Comment**: #{feedback[:comment]}" if feedback[:comment]
        lines << "- **Browser**: #{feedback[:browser]}" if feedback[:browser]
        lines << "- **Viewport**: #{feedback[:viewport]}" if feedback[:viewport]
        lines << "- **Element**: `#{feedback[:selector]}`" if feedback[:selector]
        lines << "- **Timestamp**: #{feedback[:timestamp]}" if feedback[:timestamp]
        lines << ""
        lines << "---"
        lines << "*Created by [tsukkomi](https://github.com/DaichiSaito/tsukkomi)*"

        lines.join("\n")
      end
    end
  end
end
