ALTER TABLE alerts
    ADD COLUMN deleted_at TIMESTAMP(3) NULL AFTER resolved_by,
    ADD COLUMN deleted_by INT NULL AFTER deleted_at,
    ADD CONSTRAINT fk_alerts_deleted_by
        FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX idx_alerts_deleted_at
    ON alerts (deleted_at);

CREATE TABLE alert_dismissals (
    alert_id INT NOT NULL,
    user_id INT NOT NULL,
    dismissed_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (alert_id, user_id),
    CONSTRAINT fk_alert_dismissals_alert
        FOREIGN KEY (alert_id) REFERENCES alerts(alert_id) ON DELETE CASCADE,
    CONSTRAINT fk_alert_dismissals_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
