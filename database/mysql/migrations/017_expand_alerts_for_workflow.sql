ALTER TABLE alerts
    ADD COLUMN room_code VARCHAR(30) NOT NULL DEFAULT 'P.101' AFTER alert_id,
    ADD COLUMN source VARCHAR(80) NOT NULL DEFAULT 'SYSTEM' AFTER alert_type,
    ADD COLUMN status ENUM('NEW', 'ACKNOWLEDGED', 'RESOLVED') NOT NULL DEFAULT 'NEW' AFTER severity,
    ADD COLUMN metadata JSON NULL AFTER status,
    ADD COLUMN acknowledged_by BIGINT UNSIGNED NULL AFTER metadata,
    ADD COLUMN acknowledged_at TIMESTAMP NULL AFTER acknowledged_by,
    ADD COLUMN resolved_by BIGINT UNSIGNED NULL AFTER resolved_at;

UPDATE alerts
SET status = CASE WHEN is_resolved = TRUE THEN 'RESOLVED' ELSE 'NEW' END,
    source = COALESCE(NULLIF(source, ''), alert_type),
    room_code = COALESCE(NULLIF(room_code, ''), 'P.101');

CREATE INDEX idx_alerts_room_status_created
    ON alerts (room_code, status, created_at);
