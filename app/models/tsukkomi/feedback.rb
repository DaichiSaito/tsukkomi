module Tsukkomi
  class Feedback < ApplicationRecord
    self.table_name = "tsukkomi_feedbacks"

    has_one :task, class_name: "Tsukkomi::Task", dependent: :destroy
    has_one_attached :screenshot
    has_one_attached :cropped_screenshot

    validates :comment, presence: true
  end
end
