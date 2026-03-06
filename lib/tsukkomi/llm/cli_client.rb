# frozen_string_literal: true

require "open3"
require "json"
require "tempfile"

module Tsukkomi
  module Llm
    class CliClient
      def generate_task(feedback, prompt:)
        screenshot_path = save_screenshot(feedback[:screenshot])

        begin
          full_prompt = if screenshot_path
            Prompt.build_cli_prompt(feedback, screenshot_path)
          else
            prompt
          end

          Rails.logger.info("[tsukkomi/llm] Invoking claude CLI (screenshot: #{screenshot_path ? 'yes' : 'no'})")
          start = Process.clock_gettime(Process::CLOCK_MONOTONIC)

          stdout, stderr, status = Open3.capture3(
            clean_env,
            "claude", "-p", "--output-format", "text",
            "--dangerously-skip-permissions",
            "--allowedTools", "Read",
            stdin_data: full_prompt,
            chdir: Dir.home
          )

          elapsed = (Process.clock_gettime(Process::CLOCK_MONOTONIC) - start).round(1)
          Rails.logger.info("[tsukkomi/llm] claude CLI responded (#{elapsed}s, #{stdout.length} chars)")

          unless status.success?
            raise "claude CLI exited with code #{status.exitstatus}#{stderr.present? ? "\nstderr: #{stderr}" : ""}"
          end

          json_match = stdout.match(/\{[\s\S]*\}/)
          unless json_match
            raise "Could not parse JSON from claude response"
          end

          JSON.parse(json_match[0], symbolize_names: true)
        ensure
          File.delete(screenshot_path) if screenshot_path && File.exist?(screenshot_path)
        end
      end

      private

      def clean_env
        kept_keys = %w[
          HOME USER SHELL PATH TERM LANG LC_ALL
          TMPDIR XDG_CONFIG_HOME XDG_DATA_HOME
          NODE_PATH NVM_DIR
          ANTHROPIC_API_KEY
        ]
        env = ENV.to_h.transform_values { |_| nil }
        kept_keys.each { |k| env[k] = ENV[k] if ENV.key?(k) }
        env
      end

      def save_screenshot(screenshot)
        return nil unless screenshot

        match = screenshot.match(/\Adata:image\/(png|jpeg|gif|webp);base64,(.+)\z/m)
        return nil unless match

        ext = match[1] == "jpeg" ? "jpg" : match[1]
        tmpfile = File.join(Dir.tmpdir, "tsukkomi-screenshot-#{Process.pid}-#{Time.now.to_i}.#{ext}")
        File.binwrite(tmpfile, Base64.decode64(match[2]))
        tmpfile
      end
    end
  end
end
