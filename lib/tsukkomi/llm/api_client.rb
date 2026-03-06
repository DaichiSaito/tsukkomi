# frozen_string_literal: true

require "anthropic"
require "json"

module Tsukkomi
  module Llm
    class ApiClient
      def initialize(api_key)
        @client = Anthropic::Client.new(api_key: api_key)
      end

      def generate_task(feedback, model:, prompt:)
        # Build content blocks for the API request
        has_image = false
        if feedback[:screenshot]
          match = feedback[:screenshot].match(/\Adata:image\/(png|jpeg|gif|webp);base64,(.+)\z/m)
          if match
            has_image = true
            @image_media_type = "image/#{match[1]}"
            @image_data = match[2]
          end
        end

        if has_image
          content = [
            { type: "image", source: { type: "base64", media_type: @image_media_type, data: @image_data } },
            { type: "text", text: prompt }
          ]
        else
          content = prompt
        end

        Rails.logger.info("[tsukkomi/llm] Calling Anthropic API (model: #{model}, image: #{has_image})")

        response = @client.messages.create(
          model: model,
          max_tokens: 1024,
          messages: [{ role: :user, content: content }]
        )

        # Extract text from content blocks - handle both object and hash responses
        text = response.content.filter_map { |b|
          block_type = b.respond_to?(:type) ? b.type : b[:type]
          next unless block_type.to_s == "text"
          b.respond_to?(:text) ? b.text : b[:text]
        }.join("")

        Rails.logger.info("[tsukkomi/llm] API response text (#{text.length} chars): #{text[0, 300]}")

        cleaned = text.gsub(/```(?:json)?\s*/, "").gsub(/```\s*/, "").strip
        json_match = cleaned.match(/\{[\s\S]*\}/)

        unless json_match
          raise "Could not parse JSON from API response: #{text[0, 200]}"
        end

        JSON.parse(json_match[0], symbolize_names: true)
      end
    end
  end
end
