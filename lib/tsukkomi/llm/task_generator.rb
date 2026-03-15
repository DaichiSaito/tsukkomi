# frozen_string_literal: true

require_relative "prompt"
require_relative "api_client"
require_relative "cli_client"

module Tsukkomi
  module Llm
    class TaskGenerator
      def initialize
        config = Tsukkomi.configuration
        @model = config.claude_model
        @mode = resolve_llm_mode(config)

        case @mode
        when :api
          @client = ApiClient.new(config.anthropic_api_key)
          Rails.logger.info("[tsukkomi/llm] Mode: API (model: #{@model})")
        when :cli
          @client = CliClient.new
          Rails.logger.info("[tsukkomi/llm] Mode: CLI (claude subprocess)")
        end
      end

      def generate(feedback)
        case @mode
        when :api
          generate_via_api(feedback)
        when :cli
          generate_via_cli(feedback)
        end
      end

      private

      def generate_via_api(feedback)
        has_screenshot = !!(feedback[:screenshot] && feedback[:screenshot].match?(/\Adata:image\//))
        has_cropped_screenshot = !!(feedback[:cropped_screenshot] && feedback[:cropped_screenshot].match?(/\Adata:image\//))
        prompt = Prompt.build_api_prompt(feedback, has_screenshot, has_cropped_screenshot: has_cropped_screenshot)

        task = @client.generate_task(feedback, model: @model, prompt: prompt)

        validate_and_normalize!(task)
      end

      def generate_via_cli(feedback)
        has_screenshot = !!(feedback[:screenshot] && feedback[:screenshot].match?(/\Adata:image\//))
        has_cropped_screenshot = !!(feedback[:cropped_screenshot] && feedback[:cropped_screenshot].match?(/\Adata:image\//))
        prompt = Prompt.build_api_prompt(feedback, has_screenshot, has_cropped_screenshot: has_cropped_screenshot)

        task = @client.generate_task(feedback, prompt: prompt)

        validate_and_normalize!(task)
      end

      def validate_and_normalize!(task)
        unless task[:title] && task[:category] && task[:description]
          raise "Response missing required fields (title, category, description)"
        end

        task[:labels] ||= [task[:category]]
        task
      end

      def resolve_llm_mode(config)
        case config.llm_mode
        when :api
          unless config.anthropic_api_key
            raise "[tsukkomi] llm_mode が :api ですが ANTHROPIC_API_KEY が設定されていません。" \
                  "環境変数 ANTHROPIC_API_KEY を設定するか、config.anthropic_api_key に値を指定してください。"
          end
          :api
        when :cli
          unless claude_cli_available?
            raise "[tsukkomi] llm_mode が :cli ですが Claude Code CLI (claude コマンド) が見つかりません。" \
                  "Claude Code をインストールするか、llm_mode を :api に変更してください。"
          end
          :cli
        when :auto
          if config.anthropic_api_key
            :api
          elsif claude_cli_available?
            :cli
          else
            raise "[tsukkomi] ANTHROPIC_API_KEY が未設定で、Claude Code CLI も見つかりません。" \
                  "config.llm_mode を :api または :cli に設定し、必要な認証情報を用意してください。"
          end
        end
      end

      def claude_cli_available?
        system("claude", "--version", out: File::NULL, err: File::NULL)
      end
    end
  end
end
