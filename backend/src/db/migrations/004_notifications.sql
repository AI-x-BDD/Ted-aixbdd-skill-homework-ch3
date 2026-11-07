CREATE TABLE notifications (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  type VARCHAR(24) NOT NULL,
  message VARCHAR(1000) NOT NULL,
  booking_id BIGINT NULL DEFAULT NULL,
  waitlist_entry_id BIGINT NULL DEFAULT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  read_at DATETIME(3) NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY ix_notifications_user_created (user_id, created_at, id),
  KEY ix_notifications_user_read (user_id, read_at),
  CONSTRAINT chk_notifications_type CHECK (type IN (
    'booking_created', 'review_result', 'waitlist_offer', 'booking_cancelled',
    'review_pending', 'booking_changed', 'suspension', 'waitlist_expired', 'reminder'
  )),
  CONSTRAINT fk_notifications_user_id FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_notifications_booking_id FOREIGN KEY (booking_id) REFERENCES bookings (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
