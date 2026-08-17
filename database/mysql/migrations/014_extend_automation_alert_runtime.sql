-- DEV 4 runtime extension. Execute after migrations 012 and 013.
-- Existing conditions/actions JSON remains the rule definition source.

ALTER TABLE automation_rules
    ADD COLUMN room_code VARCHAR(30) NOT NULL DEFAULT 'P.101' AFTER rule_id,
    ADD COLUMN device_id VARCHAR(50) NULL AFTER rule_name,
    ADD COLUMN min_valid_nodes TINYINT UNSIGNED NOT NULL DEFAULT 2 AFTER is_enabled,
    ADD KEY idx_automation_rules_room_enabled (room_code, is_enabled);

ALTER TABLE alerts
    ADD COLUMN room_code VARCHAR(30) NOT NULL DEFAULT 'P.101' AFTER alert_id,
    ADD COLUMN source VARCHAR(50) NOT NULL DEFAULT 'SYSTEM' AFTER alert_type,
    ADD COLUMN status ENUM('NEW', 'ACKNOWLEDGED', 'RESOLVED') NOT NULL DEFAULT 'NEW' AFTER severity,
    ADD COLUMN metadata JSON NULL AFTER status,
    ADD COLUMN acknowledged_by VARCHAR(100) NULL AFTER metadata,
    ADD COLUMN acknowledged_at TIMESTAMP NULL AFTER acknowledged_by,
    ADD COLUMN resolved_by VARCHAR(100) NULL AFTER resolved_at,
    ADD KEY idx_alerts_room_status_created (room_code, status, created_at);

UPDATE alerts
SET status = CASE WHEN is_resolved THEN 'RESOLVED' ELSE 'NEW' END
WHERE status = 'NEW';
