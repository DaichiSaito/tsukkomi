require "rails/generators"
require "rails/generators/active_record"

module Tsukkomi
  module Generators
    class UpgradeGenerator < Rails::Generators::Base
      include ActiveRecord::Generators::Migration

      source_root File.expand_path("install/templates", __dir__)

      desc "Upgrade Tsukkomi: add resolution column to tsukkomi_tasks"

      def copy_migration
        migration_template "add_resolution_to_tsukkomi_tasks.rb.erb", "db/migrate/add_resolution_to_tsukkomi_tasks.rb"
      end

      def show_post_upgrade
        say ""
        say "Tsukkomi upgrade migration created!", :green
        say ""
        say "  Next steps:", :yellow
        say "    1. rails db:migrate を実行"
        say ""
      end
    end
  end
end
