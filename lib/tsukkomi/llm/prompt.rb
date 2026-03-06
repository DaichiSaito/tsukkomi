# frozen_string_literal: true

module Tsukkomi
  module Llm
    module Prompt
      module_function

      def build_api_prompt(feedback, has_screenshot)
        custom = Tsukkomi.configuration.task_prompt
        if custom.is_a?(Proc)
          return custom.call(feedback, has_screenshot)
        end

        comment = feedback[:comment]
        page_url = feedback[:page_url] || "不明"
        selector = feedback[:selector] || "不明"
        coordinates = feedback[:coordinates]
        browser = feedback[:browser] || "不明"
        viewport = feedback[:viewport]
        timestamp = feedback[:timestamp] || "不明"

        coordinates_str = if coordinates
          "x=#{coordinates[:x]}, y=#{coordinates[:y]}, w=#{coordinates[:w]}, h=#{coordinates[:h]}"
        else
          "不明"
        end

        viewport_str = if viewport
          "#{viewport[:width]}x#{viewport[:height]}"
        else
          "不明"
        end

        screenshot_section = if has_screenshot
          <<~SECTION

            ## スクリーンショット

            添付画像を分析し、選択範囲の内容をフィードバックの文脈で解釈してください。
          SECTION
        else
          ""
        end

        prompt = <<~PROMPT
          あなたはWebアプリの品質管理アシスタントです。
          レビュアーからのフィードバックを分析し、開発チーム向けの構造化タスクを生成してください。

          ## フィードバック情報

          - **コメント**: #{comment}
          - **ページURL**: #{page_url}
          - **選択範囲のCSSセレクタ**: #{selector}
          - **選択範囲の座標**: #{coordinates_str}
          - **ブラウザ**: #{browser}
          - **ビューポート**: #{viewport_str}
          - **日時**: #{timestamp}
          #{screenshot_section}
          ## 出力形式

          以下のJSON形式のみを出力してください。コードフェンスやJSON以外のテキストは含めないでください。

          {
            "title": "タスクタイトル（簡潔に）",
            "category": "bug または improvement または question",
            "description": "## 問題\\n...\\n\\n## 再現手順\\n...\\n\\n## 推定原因\\n...\\n\\n## 推奨対応\\n1. ...\\n2. ...\\n\\n## 元のコメント\\n...\\n\\n## メタ情報\\n- URL: ...\\n- 報告者: ...\\n- 日時: ...\\n- ブラウザ: ...",
            "labels": ["bug"]
          }

          ## カテゴリ判定基準

          - **bug**: 明らかな不具合、表示崩れ、動作しない機能
          - **improvement**: 「〜してほしい」「〜の方がいい」という改善要望
          - **question**: 「〜はどうなの？」「〜は仕様？」という質問・確認

          ## 注意事項

          - titleは30文字以内で簡潔に
          - descriptionはMarkdown形式で構造化する
          - 推定原因はURLとCSSセレクタからベストエフォートで推定する
          - labelsはcategoryと同じ値を含める
          - レビュアーの曖昧なコメントでも、スクリーンショットやURLやCSSセレクタの文脈から具体化する
        PROMPT

        if custom.is_a?(String) && !custom.empty?
          prompt += "\n## 追加指示\n\n#{custom}\n"
        end

        prompt
      end

      def build_cli_prompt(feedback, screenshot_path)
        custom = Tsukkomi.configuration.task_prompt
        if custom.is_a?(Proc)
          return custom.call(feedback, !!screenshot_path)
        end

        comment = feedback[:comment]
        page_url = feedback[:page_url] || "不明"
        selector = feedback[:selector] || "不明"
        coordinates = feedback[:coordinates]
        browser = feedback[:browser] || "不明"
        viewport = feedback[:viewport]
        timestamp = feedback[:timestamp] || "不明"

        coordinates_str = if coordinates
          "x=#{coordinates[:x]}, y=#{coordinates[:y]}, w=#{coordinates[:w]}, h=#{coordinates[:h]}"
        else
          "不明"
        end

        viewport_str = if viewport
          "#{viewport[:width]}x#{viewport[:height]}"
        else
          "不明"
        end

        screenshot_section = if screenshot_path
          <<~SECTION

            ## スクリーンショット

            以下のスクリーンショット画像を Read ツールで読み取り、選択範囲の内容を分析してください。
            ファイルパス: #{screenshot_path}
          SECTION
        else
          ""
        end

        prompt = <<~PROMPT
          あなたはWebアプリの品質管理アシスタントです。
          レビュアーからのフィードバックを分析し、開発チーム向けの構造化タスクを生成してください。

          ## フィードバック情報

          - **コメント**: #{comment}
          - **ページURL**: #{page_url}
          - **選択範囲のCSSセレクタ**: #{selector}
          - **選択範囲の座標**: #{coordinates_str}
          - **ブラウザ**: #{browser}
          - **ビューポート**: #{viewport_str}
          - **日時**: #{timestamp}
          #{screenshot_section}
          ## 出力形式

          以下のJSON形式で出力してください。JSON以外のテキストは含めないでください。

          ```json
          {
            "title": "タスクタイトル（簡潔に）",
            "category": "bug または improvement または question",
            "description": "## 問題\\n...\\n\\n## 再現手順\\n...\\n\\n## 推定原因\\n...\\n\\n## 推奨対応\\n1. ...\\n2. ...\\n\\n## 元のコメント\\n...\\n\\n## メタ情報\\n- URL: ...\\n- 報告者: ...\\n- 日時: ...\\n- ブラウザ: ...",
            "labels": ["bug"]
          }
          ```

          ## カテゴリ判定基準

          - **bug**: 明らかな不具合、表示崩れ、動作しない機能
          - **improvement**: 「〜してほしい」「〜の方がいい」という改善要望
          - **question**: 「〜はどうなの？」「〜は仕様？」という質問・確認

          ## 注意事項

          - titleは30文字以内で簡潔に
          - descriptionはMarkdown形式で構造化する
          - 推定原因はURLとCSSセレクタからベストエフォートで推定する
          - labelsはcategoryと同じ値を含める
          - レビュアーの曖昧なコメントでも、スクリーンショットやURLやCSSセレクタの文脈から具体化する
        PROMPT

        if custom.is_a?(String) && !custom.empty?
          prompt += "\n## 追加指示\n\n#{custom}\n"
        end

        prompt
      end
    end
  end
end
