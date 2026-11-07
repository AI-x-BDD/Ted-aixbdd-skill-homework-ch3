CREATE TABLE rule_changes (
  id BIGINT NOT NULL AUTO_INCREMENT,
  rule_key VARCHAR(40) NOT NULL,
  actor_user_id BIGINT NOT NULL,
  changed_at DATETIME(3) NOT NULL,
  old_value INT NOT NULL,
  new_value INT NOT NULL,
  PRIMARY KEY (id),
  KEY ix_rule_changes_changed (changed_at, id),
  CONSTRAINT fk_rule_changes_rule_key FOREIGN KEY (rule_key) REFERENCES rules (rule_key),
  CONSTRAINT fk_rule_changes_actor_user_id FOREIGN KEY (actor_user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TRIGGER trg_rule_changes_no_update BEFORE UPDATE ON rule_changes
  FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '紀錄不可修改';
CREATE TRIGGER trg_rule_changes_no_delete BEFORE DELETE ON rule_changes
  FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '紀錄不可修改';
