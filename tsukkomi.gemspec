Gem::Specification.new do |spec|
  spec.name          = "tsukkomi"
  spec.version       = "0.1.0"
  spec.authors       = ["Daichi Saito"]
  spec.summary       = "Rails Engine for collecting feedback with LLM-powered task generation"
  spec.description   = "A development-only Rails Engine that provides a browser widget for screenshot-based feedback, LLM task generation via Claude, and backend integrations (GitHub Issues, etc.)."
  spec.homepage      = "https://github.com/DaichiSaito/tsukkomi"
  spec.license       = "MIT"

  spec.required_ruby_version = ">= 3.1.0"

  spec.files = Dir[
    "app/**/*",
    "config/**/*",
    "db/**/*",
    "lib/**/*",
    "Rakefile",
    "LICENSE.txt"
  ]

  spec.add_dependency "rails", ">= 7.0"
  spec.add_dependency "anthropic", ">= 0.1"
end
