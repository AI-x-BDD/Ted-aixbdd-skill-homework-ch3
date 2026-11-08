CREATE TABLE favorite_venues (
  user_id BIGINT NOT NULL,
  venue_id BIGINT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, venue_id),
  KEY ix_favorite_venues_venue (venue_id),
  CONSTRAINT fk_favorite_venues_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_favorite_venues_venue_id FOREIGN KEY (venue_id) REFERENCES venues (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE booking_defaults (
  user_id BIGINT NOT NULL,
  attendees INT NOT NULL,
  duration_minutes INT NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (user_id),
  CONSTRAINT chk_booking_defaults_attendees CHECK (attendees >= 1),
  CONSTRAINT chk_booking_defaults_duration CHECK (duration_minutes >= 30 AND duration_minutes % 30 = 0),
  CONSTRAINT fk_booking_defaults_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
