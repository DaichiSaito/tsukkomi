# frozen_string_literal: true

require_relative "base"

module Tsukkomi
  module Backends
    module Registry
      @adapters = {}
      @active_backends = {}

      class << self
        def register(name, klass)
          @adapters[name.to_s] = klass
        end

        def initialize_backends(names, configs = {})
          @active_backends = {}

          names.each do |name|
            name = name.to_s
            klass = @adapters[name]

            unless klass
              Rails.logger.warn("[backends] Unknown backend: \"#{name}\" (skipped)")
              next
            end

            begin
              backend = klass.new(configs[name] || configs[name.to_sym] || {})
              @active_backends[name] = backend
              Rails.logger.info("[backends] #{name}: initialized")
            rescue => e
              Rails.logger.warn("[backends] #{name}: initialization failed — #{e.message}")
            end
          end

          if @active_backends.empty?
            Rails.logger.warn("[backends] No backends active. Feedback will be processed but not persisted.")
          end
        end

        def submit_to_all(task, feedback)
          results = {}
          any_succeeded = false

          @active_backends.each do |name, backend|
            begin
              result = backend.submit_task(task, feedback)
              results[name] = { status: "ok", result: result }
              any_succeeded = true
            rescue => e
              Rails.logger.warn("[backends] #{name}: submit_task failed — #{e.message}")
              results[name] = { status: "error", message: e.message }
            end
          end

          { results: results, any_succeeded: any_succeeded }
        end

        def shutdown_all
          @active_backends.each do |name, backend|
            begin
              backend.shutdown
            rescue => e
              Rails.logger.warn("[backends] #{name}: shutdown error — #{e.message}")
            end
          end
          @active_backends = {}
        end

        def active_names
          @active_backends.keys
        end

        def reset!
          @adapters = {}
          @active_backends = {}
        end
      end
    end
  end
end

require_relative "github_issues"
require_relative "vibe_kanban"

Tsukkomi::Backends::Registry.register("github_issues", Tsukkomi::Backends::GithubIssues)
Tsukkomi::Backends::Registry.register("vibe_kanban", Tsukkomi::Backends::VibeKanban)
