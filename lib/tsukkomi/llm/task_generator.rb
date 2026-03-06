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

        if config.anthropic_api_key
          @mode = :api
          @client = ApiClient.new(config.anthropic_api_key)
          Rails.logger.info("[tsukkomi/llm] Mode: API (model: #{@model})")
        elsif claude_cli_available?
          @mode = :cli
          @client = CliClient.new
          Rails.logger.info("[tsukkomi/llm] Mode: CLI (claude subprocess)")
        else
          raise "ANTHROPIC_API_KEY が未設定で、Claude Code CLI も見つかりません"
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
        prompt = Prompt.build_api_prompt(feedback, has_screenshot)

        task = @client.generate_task(feedback, model: @model, prompt: prompt)

        validate_and_normalize!(task)
      end

      def generate_via_cli(feedback)
        has_screenshot = !!(feedback[:screenshot] && feedback[:screenshot].match?(/\Adata:image\//))
        prompt = Prompt.build_api_prompt(feedback, has_screenshot)

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

      def claude_cli_available?
        system("claude", "--version", out: File::NULL, err: File::NULL)
      end
    end
  end
end
