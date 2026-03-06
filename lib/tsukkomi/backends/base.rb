# frozen_string_literal: true

module Tsukkomi
  module Backends
    class Base
      def initialize(config)
        @config = config
      end

      def submit_task(task, feedback)
        raise NotImplementedError
      end

      def shutdown
      end
    end
  end
end
