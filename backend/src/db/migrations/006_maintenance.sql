CREATE TABLE venue_maintenance_windows (
  id BIGINT NOT NULL AUTO_INCREMENT,
  venue_id BIGINT NOT NULL,
  start_at DATETIME(3) NOT NULL,
  end_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY ix_maintenance_venue_start (venue_id, start_at),
  CONSTRAINT chk_maintenance_range CHECK (end_at > start_at),
  CONSTRAINT fk_maintenance_venue_id FOREIGN KEY (venue_id) REFERENCES venues (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
