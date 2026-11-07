CREATE TABLE waitlist_entries (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  venue_id BIGINT NOT NULL,
  start_at DATETIME(3) NOT NULL,
  end_at DATETIME(3) NOT NULL,
  subject VARCHAR(100) NOT NULL,
  attendees INT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  status VARCHAR(16) NOT NULL,
  offer_expires_at DATETIME(3) NULL DEFAULT NULL,
  close_reason VARCHAR(24) NULL DEFAULT NULL,
  closed_at DATETIME(3) NULL DEFAULT NULL,
  booking_id BIGINT NULL DEFAULT NULL,
  active_dup_key TINYINT GENERATED ALWAYS AS (IF(status IN ('waiting', 'offered'), 1, NULL)) STORED,
  PRIMARY KEY (id),
  KEY ix_waitlist_slot (venue_id, start_at, end_at, status, created_at),
  KEY ix_waitlist_user_status (user_id, status, created_at),
  KEY ix_waitlist_status_offer (status, offer_expires_at),
  KEY ix_waitlist_status_start (status, start_at),
  UNIQUE KEY uk_waitlist_active_dup (user_id, venue_id, start_at, end_at, active_dup_key),
  CONSTRAINT chk_waitlist_status CHECK (status IN ('waiting', 'offered', 'confirmed', 'expired', 'cancelled')),
  CONSTRAINT chk_waitlist_close_reason CHECK (
    close_reason IS NULL OR close_reason IN (
      'offer_timeout', 'confirm_failed', 'declined', 'venue_disabled', 'account_disabled', 'started', 'cancelled'
    )
  ),
  CONSTRAINT fk_waitlist_user_id FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_waitlist_venue_id FOREIGN KEY (venue_id) REFERENCES venues (id),
  CONSTRAINT fk_waitlist_booking_id FOREIGN KEY (booking_id) REFERENCES bookings (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE notifications
  ADD CONSTRAINT fk_notifications_waitlist_entry_id
  FOREIGN KEY (waitlist_entry_id) REFERENCES waitlist_entries (id);
