# frozen_string_literal: true

require "json"

module Tsukkomi
  module Llm
    module JsonRepair
      module_function

      def parse_lenient(raw)
        JSON.parse(raw, symbolize_names: true)
      rescue JSON::ParserError => e
        Rails.logger.warn("[tsukkomi/llm] JSON parse failed, attempting repair: #{e.message}")

        # Fix unescaped double quotes inside JSON string values.
        repaired = raw.gsub(/("(?:title|category|description)":\s*")(.*?)("\s*[,}])/m) do
          prefix, value, suffix = $1, $2, $3
          fixed_value = value.gsub(/(?<!\\)"/, '\\"')
          "#{prefix}#{fixed_value}#{suffix}"
        end

        begin
          JSON.parse(repaired, symbolize_names: true)
        rescue JSON::ParserError
          # Last resort: extract fields individually
          title = raw[/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/m, 1] || "パースエラー"
          category = raw[/"category"\s*:\s*"((?:[^"\\]|\\.)*)"/m, 1] || "improvement"
          description = extract_description(raw)
          { title: title, category: category, description: description, labels: [category] }
        end
      end

      def extract_description(raw)
        match = raw.match(/"description"\s*:\s*"([\s\S]*?)"\s*[,}]\s*"labels"/m)
        if match
          match[1].gsub('\\"', '"').gsub("\\n", "\n")
        else
          "LLMレスポンスのパースに失敗しました。元のレスポンスを確認してください。"
        end
      end
    end
  end
end
