require "tsukkomi/configuration"
require "tsukkomi/engine"
require "tsukkomi/llm/prompt"
require "tsukkomi/llm/api_client"
require "tsukkomi/llm/task_generator"
require "tsukkomi/backends/base"
require "tsukkomi/backends/registry"

module Tsukkomi
  class << self
    def configuration
      @configuration ||= Configuration.new
    end

    def configure
      yield(configuration)
    end

    def reset_configuration!
      @configuration = Configuration.new
    end
  end
end
