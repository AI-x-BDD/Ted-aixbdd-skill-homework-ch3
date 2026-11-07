CREATE TABLE booking_series (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  venue_id BIGINT NOT NULL,
  frequency VARCHAR(16) NOT NULL,
  first_date DATE NOT NULL,
  last_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  subject VARCHAR(100) NOT NULL,
  attendees INT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  session_count INT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT chk_series_frequency CHECK (frequency IN ('weekly', 'biweekly')),
  CONSTRAINT chk_series_status CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled')),
  CONSTRAINT fk_series_user_id FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_series_venue_id FOREIGN KEY (venue_id) REFERENCES venues (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE bookings (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  venue_id BIGINT NOT NULL,
  start_at DATETIME(3) NOT NULL,
  end_at DATETIME(3) NOT NULL,
  subject VARCHAR(100) NOT NULL,
  attendees INT NOT NULL,
  status VARCHAR(16) NOT NULL,
  series_id BIGINT NULL DEFAULT NULL,
  series_index INT NULL DEFAULT NULL,
  late_cancel TINYINT NOT NULL DEFAULT 0,
  confirmed_at DATETIME(3) NULL DEFAULT NULL,
  reminder_sent_at DATETIME(3) NULL DEFAULT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_bookings_user_status_start (user_id, status, start_at),
  KEY ix_bookings_venue_start_status (venue_id, start_at, status),
  KEY ix_bookings_status_start (status, start_at),
  KEY ix_bookings_start (start_at),
  UNIQUE KEY uk_bookings_series_index (series_id, series_index),
  CONSTRAINT chk_bookings_status CHECK (status IN ('pending', 'confirmed', 'checked_in', 'completed', 'rejected', 'cancelled', 'no_show')),
  CONSTRAINT chk_bookings_range CHECK (end_at > start_at),
  CONSTRAINT chk_bookings_attendees CHECK (attendees >= 1),
  CONSTRAINT fk_bookings_user_id FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_bookings_venue_id FOREIGN KEY (venue_id) REFERENCES venues (id),
  CONSTRAINT fk_bookings_series_id FOREIGN KEY (series_id) REFERENCES booking_series (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE booking_slots (
  venue_id BIGINT NOT NULL,
  slot_start_at DATETIME(3) NOT NULL,
  holder_type VARCHAR(16) NOT NULL,
  holder_id BIGINT NOT NULL,
  CONSTRAINT pk_booking_slots PRIMARY KEY (venue_id, slot_start_at),
  KEY ix_booking_slots_holder (holder_type, holder_id),
  KEY ix_booking_slots_slot_start_at (slot_start_at),
  CONSTRAINT chk_slots_holder_type CHECK (holder_type IN ('booking', 'hold', 'maintenance')),
  CONSTRAINT chk_slots_alignment CHECK (
    MINUTE(slot_start_at) IN (0, 30)
    AND SECOND(slot_start_at) = 0
    AND MICROSECOND(slot_start_at) = 0
  ),
  CONSTRAINT fk_booking_slots_venue_id FOREIGN KEY (venue_id) REFERENCES venues (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE booking_events (
  id BIGINT NOT NULL AUTO_INCREMENT,
  booking_id BIGINT NOT NULL,
  actor_user_id BIGINT NULL DEFAULT NULL,
  actor_type VARCHAR(16) NOT NULL,
  occurred_at DATETIME(3) NOT NULL,
  from_status VARCHAR(16) NULL DEFAULT NULL,
  to_status VARCHAR(16) NOT NULL,
  reason VARCHAR(500) NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY ix_booking_events_booking (booking_id, occurred_at, id),
  CONSTRAINT chk_events_actor_type CHECK (actor_type IN ('user', 'reviewer', 'admin', 'system')),
  CONSTRAINT chk_events_from_status CHECK (
    from_status IS NULL OR from_status IN ('pending', 'confirmed', 'checked_in', 'completed', 'rejected', 'cancelled', 'no_show')
  ),
  CONSTRAINT chk_events_to_status CHECK (to_status IN ('pending', 'confirmed', 'checked_in', 'completed', 'rejected', 'cancelled', 'no_show')),
  CONSTRAINT fk_booking_events_booking_id FOREIGN KEY (booking_id) REFERENCES bookings (id),
  CONSTRAINT fk_booking_events_actor_user_id FOREIGN KEY (actor_user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TRIGGER trg_booking_events_no_update BEFORE UPDATE ON booking_events
  FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '紀錄不可修改';
CREATE TRIGGER trg_booking_events_no_delete BEFORE DELETE ON booking_events
  FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '紀錄不可修改';
