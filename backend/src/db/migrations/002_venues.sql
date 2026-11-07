CREATE TABLE venues (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  location VARCHAR(200) NOT NULL,
  capacity INT NOT NULL,
  equipment JSON NOT NULL DEFAULT (JSON_ARRAY()),
  requires_approval TINYINT NOT NULL DEFAULT 0,
  is_active TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_venues_name (name),
  CONSTRAINT chk_venues_capacity CHECK (capacity >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE venue_opening_hours (
  id BIGINT NOT NULL AUTO_INCREMENT,
  venue_id BIGINT NOT NULL,
  weekday TINYINT NOT NULL,
  open_minute SMALLINT NOT NULL,
  close_minute SMALLINT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_opening_hours_segment (venue_id, weekday, open_minute),
  CONSTRAINT chk_opening_weekday CHECK (weekday BETWEEN 0 AND 6),
  CONSTRAINT chk_opening_minutes CHECK (
    open_minute % 30 = 0 AND close_minute % 30 = 0
    AND open_minute >= 0 AND open_minute < close_minute AND close_minute <= 1440
  ),
  CONSTRAINT fk_opening_hours_venue_id FOREIGN KEY (venue_id) REFERENCES venues (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE venue_reviewers (
  venue_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  CONSTRAINT pk_venue_reviewers PRIMARY KEY (venue_id, user_id),
  KEY ix_venue_reviewers_user (user_id),
  CONSTRAINT fk_venue_reviewers_venue_id FOREIGN KEY (venue_id) REFERENCES venues (id),
  CONSTRAINT fk_venue_reviewers_user_id FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
