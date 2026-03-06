# frozen_string_literal: true

module Tsukkomi
  module Backends
    class VibeKanban < Base
      def submit_task(task, feedback)
        raise NotImplementedError, "vibe-kanban backend is not yet implemented for Ruby"
      end
    end
  end
end
