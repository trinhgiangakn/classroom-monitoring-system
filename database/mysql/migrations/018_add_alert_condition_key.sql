ALTER TABLE alerts
    ADD COLUMN condition_key VARCHAR(160) NULL AFTER source;

CREATE INDEX idx_alerts_open_condition
    ON alerts (room_code, condition_key, status, created_at);
