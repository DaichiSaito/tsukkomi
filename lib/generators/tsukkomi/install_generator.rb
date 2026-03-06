require "rails/generators"
require "rails/generators/active_record"

module Tsukkomi
  module Generators
    class InstallGenerator < Rails::Generators::Base
      include ActiveRecord::Generators::Migration

      source_root File.expand_path("install/templates", __dir__)

      desc "Install Tsukkomi: copy migrations, create initializer, mount engine"

      def copy_migrations
        migration_template "create_tsukkomi_feedbacks.rb.erb", "db/migrate/create_tsukkomi_feedbacks.rb"
        migration_template "create_tsukkomi_tasks.rb.erb", "db/migrate/create_tsukkomi_tasks.rb"
      end

      def create_initializer
        template "initializer.rb", "config/initializers/tsukkomi.rb"
      end

      def mount_engine
        route 'mount Tsukkomi::Engine, at: "/tsukkomi" if Rails.env.development?'
      end

      def show_post_install
        say ""
        say "Tsukkomi installed successfully!", :green
        say ""
        say "  Created:", :yellow
        say "    db/migrate/xxx_create_tsukkomi_feedbacks.rb"
        say "    db/migrate/xxx_create_tsukkomi_tasks.rb"
        say "    config/initializers/tsukkomi.rb"
        say ""
        say "  Next steps:", :yellow
        say "    1. config/initializers/tsukkomi.rb を編集して設定"
        say "    2. rails db:migrate を実行"
        say "    3. Rails サーバーを起動して /tsukkomi/admin にアクセス"
        say ""
      end
    end
  end
end
