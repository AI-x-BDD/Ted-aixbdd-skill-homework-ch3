CREATE TABLE users (
  id BIGINT NOT NULL AUTO_INCREMENT,
  email VARCHAR(254) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  name VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active TINYINT NOT NULL DEFAULT 1,
  must_change_password TINYINT NOT NULL DEFAULT 0,
  suspended_until_at DATETIME(3) NULL DEFAULT NULL,
  no_show_counted_from_at DATETIME(3) NULL DEFAULT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE user_roles (
  user_id BIGINT NOT NULL,
  role VARCHAR(16) NOT NULL,
  CONSTRAINT pk_user_roles PRIMARY KEY (user_id, role),
  CONSTRAINT chk_user_roles_role CHECK (role IN ('reviewer', 'admin')),
  CONSTRAINT fk_user_roles_user_id FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE sessions (
  id BIGINT NOT NULL AUTO_INCREMENT,
  token_hash CHAR(64) NOT NULL,
  user_id BIGINT NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sessions_token_hash (token_hash),
  KEY ix_sessions_user (user_id),
  CONSTRAINT fk_sessions_user_id FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE rules (
  rule_key VARCHAR(40) NOT NULL,
  int_value INT NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_by BIGINT NULL DEFAULT NULL,
  PRIMARY KEY (rule_key),
  CONSTRAINT chk_rules_int_value CHECK (int_value >= 1),
  CONSTRAINT chk_rules_key CHECK (rule_key IN (
    'max_duration_minutes',
    'max_advance_days',
    'max_active_bookings',
    'max_active_series',
    'max_series_months',
    'late_cancel_minutes',
    'waitlist_confirm_minutes',
    'waitlist_cutoff_minutes',
    'checkin_open_minutes',
    'checkin_close_minutes',
    'no_show_window_days',
    'no_show_threshold',
    'suspend_days',
    'reminder_minutes'
  )),
  CONSTRAINT fk_rules_updated_by FOREIGN KEY (updated_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO rules (rule_key, int_value, updated_by) VALUES
  ('max_duration_minutes', 240, NULL),
  ('max_advance_days', 30, NULL),
  ('max_active_bookings', 5, NULL),
  ('max_active_series', 2, NULL),
  ('max_series_months', 3, NULL),
  ('late_cancel_minutes', 60, NULL),
  ('waitlist_confirm_minutes', 30, NULL),
  ('waitlist_cutoff_minutes', 60, NULL),
  ('checkin_open_minutes', 10, NULL),
  ('checkin_close_minutes', 15, NULL),
  ('no_show_window_days', 30, NULL),
  ('no_show_threshold', 3, NULL),
  ('suspend_days', 7, NULL),
  ('reminder_minutes', 30, NULL);
