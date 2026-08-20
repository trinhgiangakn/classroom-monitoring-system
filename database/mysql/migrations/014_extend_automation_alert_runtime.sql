-- DEV 4 automation runtime extension. Alert workflow columns are owned by
-- 014_expand_alerts_for_workflow.sql, which runs immediately before this file.
-- IF NOT EXISTS also makes this safe after a previously interrupted migration.

SET @automation_room_sql = IF(
    (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'automation_rules' AND column_name = 'room_code') = 0,
    'ALTER TABLE automation_rules ADD COLUMN room_code VARCHAR(30) NOT NULL DEFAULT ''P.101'' AFTER rule_id',
    'SELECT 1'
);
PREPARE automation_migration_statement FROM @automation_room_sql;
EXECUTE automation_migration_statement;
DEALLOCATE PREPARE automation_migration_statement;

SET @automation_device_sql = IF(
    (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'automation_rules' AND column_name = 'device_id') = 0,
    'ALTER TABLE automation_rules ADD COLUMN device_id VARCHAR(50) NULL AFTER rule_name',
    'SELECT 1'
);
PREPARE automation_migration_statement FROM @automation_device_sql;
EXECUTE automation_migration_statement;
DEALLOCATE PREPARE automation_migration_statement;

SET @automation_nodes_sql = IF(
    (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'automation_rules' AND column_name = 'min_valid_nodes') = 0,
    'ALTER TABLE automation_rules ADD COLUMN min_valid_nodes TINYINT UNSIGNED NOT NULL DEFAULT 2 AFTER is_enabled',
    'SELECT 1'
);
PREPARE automation_migration_statement FROM @automation_nodes_sql;
EXECUTE automation_migration_statement;
DEALLOCATE PREPARE automation_migration_statement;

SET @automation_index_exists = (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'automation_rules'
      AND index_name = 'idx_automation_rules_room_enabled'
);

SET @automation_index_sql = IF(
    @automation_index_exists = 0,
    'CREATE INDEX idx_automation_rules_room_enabled ON automation_rules (room_code, is_enabled)',
    'SELECT 1'
);

PREPARE automation_index_statement FROM @automation_index_sql;
EXECUTE automation_index_statement;
DEALLOCATE PREPARE automation_index_statement;
