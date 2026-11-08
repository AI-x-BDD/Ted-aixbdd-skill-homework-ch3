CREATE TABLE booking_invitations (
  id BIGINT NOT NULL AUTO_INCREMENT,
  booking_id BIGINT NOT NULL,
  invitee_user_id BIGINT NOT NULL,
  status VARCHAR(12) NOT NULL,
  response VARCHAR(12) NOT NULL DEFAULT 'none',
  invalid_reason VARCHAR(24) NULL DEFAULT NULL,
  pending_change VARCHAR(8) NULL DEFAULT NULL,
  notified_at DATETIME(3) NULL DEFAULT NULL,
  reminder_sent_at DATETIME(3) NULL DEFAULT NULL,
  responded_at DATETIME(3) NULL DEFAULT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  live_user_id BIGINT GENERATED ALWAYS AS (IF(status IN ('pending', 'active'), invitee_user_id, NULL)) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY uk_invitations_live (booking_id, live_user_id),
  KEY ix_invitations_invitee (invitee_user_id, status),
  KEY ix_invitations_booking (booking_id, status),
  KEY ix_invitations_reminder (status, reminder_sent_at),
  CONSTRAINT chk_invitations_status CHECK (status IN ('pending', 'active', 'invalid')),
  CONSTRAINT chk_invitations_response CHECK (response IN ('none', 'accepted', 'declined')),
  CONSTRAINT chk_invitations_invalid_reason CHECK (invalid_reason IS NULL OR invalid_reason IN ('booking_cancelled', 'removed', 'account_disabled')),
  CONSTRAINT chk_invitations_pending_change CHECK (pending_change IS NULL OR pending_change IN ('time', 'venue')),
  CONSTRAINT chk_invitations_invalid_pair CHECK (
    (status = 'invalid' AND invalid_reason IS NOT NULL) OR
    (status IN ('pending', 'active') AND invalid_reason IS NULL)
  ),
  CONSTRAINT chk_invitations_pending_response CHECK (status <> 'pending' OR response = 'none'),
  CONSTRAINT chk_invitations_responded_at CHECK (
    (response = 'none' AND responded_at IS NULL) OR
    (response IN ('accepted', 'declined') AND responded_at IS NOT NULL)
  ),
  CONSTRAINT fk_booking_invitations_booking_id FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE RESTRICT,
  CONSTRAINT fk_booking_invitations_invitee_user_id FOREIGN KEY (invitee_user_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TRIGGER trg_booking_invitations_status_guard BEFORE UPDATE ON booking_invitations
  FOR EACH ROW
  BEGIN
    IF OLD.status = 'invalid'
       AND (NEW.status <> 'invalid' OR NEW.response <> OLD.response
            OR NOT (NEW.responded_at <=> OLD.responded_at)
            OR NOT (NEW.invalid_reason <=> OLD.invalid_reason)) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '邀請狀態不可回復';
    END IF;
    IF OLD.status = 'active' AND NEW.status = 'pending' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '邀請狀態不可回復';
    END IF;
  END;

ALTER TABLE notifications
  ADD COLUMN invitation_id BIGINT NULL DEFAULT NULL,
  ADD KEY ix_notifications_invitation (invitation_id),
  ADD CONSTRAINT fk_notifications_invitation_id FOREIGN KEY (invitation_id) REFERENCES booking_invitations (id) ON DELETE RESTRICT;

ALTER TABLE notifications
  DROP CHECK chk_notifications_type,
  ADD CONSTRAINT chk_notifications_type CHECK (type IN (
    'booking_created', 'review_result', 'waitlist_offer', 'booking_cancelled',
    'review_pending', 'booking_changed', 'suspension', 'waitlist_expired', 'reminder',
    'invitation_received', 'invitation_changed', 'invitation_cancelled',
    'invitation_removed', 'invitation_reminder'
  ));
