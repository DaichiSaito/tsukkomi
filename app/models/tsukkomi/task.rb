module Tsukkomi
  class Task < ApplicationRecord
    self.table_name = "tsukkomi_tasks"

    belongs_to :feedback, class_name: "Tsukkomi::Feedback"

    CATEGORIES = %w[bug improvement question].freeze
    STATUSES = %w[processing generated pending synced failed].freeze
    RESOLUTIONS = %w[open closed wontfix].freeze

    validates :title, presence: true
    validates :category, presence: true, inclusion: { in: CATEGORIES }
    validates :status, inclusion: { in: STATUSES }
    validates :resolution, inclusion: { in: RESOLUTIONS }

    scope :by_status, ->(status) { where(status: status) if status.present? }
    scope :by_category, ->(category) { where(category: category) if category.present? }
    scope :by_resolution, ->(resolution) { where(resolution: resolution) if resolution.present? }
    scope :search, ->(query) {
      where("title ILIKE :q OR description ILIKE :q", q: "%#{query}%") if query.present?
    }
    scope :recent, -> { order(created_at: :desc) }

    def open?
      resolution == "open"
    end

    def closed?
      resolution == "closed"
    end

    def wontfix?
      resolution == "wontfix"
    end

    def close!
      update!(resolution: "closed", closed_at: Time.current)
    end

    def wontfix!
      update!(resolution: "wontfix", closed_at: Time.current)
    end

    def reopen!
      update!(resolution: "open", closed_at: nil)
    end
  end
end
