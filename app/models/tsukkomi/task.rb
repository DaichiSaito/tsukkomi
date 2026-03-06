module Tsukkomi
  class Task < ApplicationRecord
    self.table_name = "tsukkomi_tasks"

    belongs_to :feedback, class_name: "Tsukkomi::Feedback"

    CATEGORIES = %w[bug improvement question].freeze
    STATUSES = %w[processing generated pending synced failed].freeze

    validates :title, presence: true
    validates :category, presence: true, inclusion: { in: CATEGORIES }
    validates :status, inclusion: { in: STATUSES }

    scope :by_status, ->(status) { where(status: status) if status.present? }
    scope :by_category, ->(category) { where(category: category) if category.present? }
    scope :search, ->(query) {
      where("title ILIKE :q OR description ILIKE :q", q: "%#{query}%") if query.present?
    }
    scope :recent, -> { order(created_at: :desc) }
  end
end
