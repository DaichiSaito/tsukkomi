require "bundler/gem_tasks"

namespace :tsukkomi do
  desc "Build widget JavaScript bundle with esbuild"
  task :build_widget do
    widget_dir = File.expand_path("app/assets/javascripts/tsukkomi", __dir__)
    output = File.expand_path("app/assets/builds/tsukkomi/widget.bundle.js", __dir__)

    unless system("which npx > /dev/null 2>&1")
      abort "npx not found. Install Node.js to build the widget."
    end

    cmd = %W[
      npx esbuild
      #{File.join(widget_dir, 'widget.js')}
      --bundle --minify --format=iife
      --target=es2020 --platform=browser
      --outfile=#{output}
    ].join(" ")

    puts "Building widget bundle..."
    unless system(cmd)
      abort "Widget build failed."
    end
    puts "Built: #{output}"
  end
end
