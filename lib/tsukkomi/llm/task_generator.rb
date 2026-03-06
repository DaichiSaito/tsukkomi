# frozen_string_literal: true

require_relative "prompt"
require_relative "api_client"

module Tsukkomi
  module Llm
    class TaskGenerator
      def initialize
        config = Tsukkomi.configuration
        api_key = config.anthropic_api_key
        raise "ANTHROPIC_API_KEY is not configured" unless api_key

        @model = config.claude_model
        @client = ApiClient.new(api_key)
      end

      def generate(feedback)
        has_screenshot = !!(feedback[:screenshot] && feedback[:screenshot].match?(/\Adata:image\//))
        prompt = Prompt.build_api_prompt(feedback, has_screenshot)

        task = @client.generate_task(feedback, model: @model, prompt: prompt)

        unless task[:title] && task[:category] && task[:description]
          raise "API response missing required fields (title, category, description)"
        end

        task[:labels] ||= [task[:category]]

        task
      end
    end
  end
end
