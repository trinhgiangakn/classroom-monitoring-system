/**
 * Script to fix devices, foreign keys, and seed default automation rules on Aiven.
 * Usage: node scripts/sync-cloud-database.js <AIVEN_PASSWORD>
 */
const mysql = require('../backend/node_modules/mysql2/promise');

const AIVEN_HOST = 'mysql-1e258287-intern-phase-2-fpt.j.aivencloud.com';
const AIVEN_PORT = 13334;
const AIVEN_USER = 'avnadmin';
const AIVEN_DB   = 'defaultdb';

async function main() {
    const password = process.argv[2];
    if (!password) {
        console.error('Usage: node scripts/sync-cloud-database.js <AIVEN_PASSWORD>');
        process.exit(1);
    }

    const connection = await mysql.createConnection({
        host: AIVEN_HOST,
        port: AIVEN_PORT,
        user: AIVEN_USER,
        password,
        database: AIVEN_DB,
        ssl: { rejectUnauthorized: false },
    });

    try {
        console.log('Connected to Aiven MySQL. Starting sync...\n');

        // 1. Ensure canonical devices exist: LIGHT_01, FAN_01, HUMIDIFIER_01, CURTAIN_01
        const devices = [
            ['LIGHT_01',      'Đèn chiếu sáng', 'RELAY', 'OFF', 'OFF', 'MANUAL', 'OK', 'OK', 30],
            ['FAN_01',        'Quạt thông gió',  'RELAY', 'OFF', 'OFF', 'MANUAL', 'OK', 'OK', 30],
            ['HUMIDIFIER_01', 'Máy cấp ẩm',      'RELAY', 'OFF', 'OFF', 'MANUAL', 'OK', 'OK', 30],
            ['CURTAIN_01',    'Rèm cửa',          'MOTOR', 'STOPPED', 'STOPPED', 'MANUAL', 'OK', 'OK', 30],
        ];

        for (const [id, name, type, actual, desired, mode, l_open, l_close, timeout] of devices) {
            await connection.query(
                `INSERT INTO devices (device_id, name, type, actual_state, desired_state, operation_mode, limit_open_status, limit_close_status, timeout_seconds)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE name = VALUES(name), type = VALUES(type), operation_mode = VALUES(operation_mode)`,
                [id, name, type, actual, desired, mode, l_open, l_close, timeout]
            );
            console.log(`✅ Seeded device: ${id} (${name})`);
        }

        // 2. Check and apply migration 014 (columns to automation_rules & alerts) if needed
        console.log('\nChecking automation_rules columns...');
        const [ruleCols] = await connection.query(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'automation_rules'`,
            [AIVEN_DB]
        );
        const colNames = ruleCols.map(c => c.COLUMN_NAME);

        if (!colNames.includes('room_code')) {
            await connection.query("ALTER TABLE automation_rules ADD COLUMN room_code VARCHAR(30) NOT NULL DEFAULT 'P.101'");
            console.log('✅ Added room_code to automation_rules');
        }
        if (!colNames.includes('device_id')) {
            await connection.query("ALTER TABLE automation_rules ADD COLUMN device_id VARCHAR(50) NULL");
            console.log('✅ Added device_id to automation_rules');
        }
        if (!colNames.includes('min_valid_nodes')) {
            await connection.query("ALTER TABLE automation_rules ADD COLUMN min_valid_nodes TINYINT UNSIGNED NOT NULL DEFAULT 2");
            console.log('✅ Added min_valid_nodes to automation_rules');
        }

        // 3. Seed default automation rules
        const defaultRules = [
            {
                rule_name: 'Tự động bật/tắt quạt theo nhiệt độ',
                room_code: 'P.101',
                device_id: 'FAN_01',
                conditions: JSON.stringify({
                    sensor: 'temperature',
                    delay_ms: 5000,
                    activation: { threshold: 30.0, comparison: 'GT', action: 'TURN_ON' },
                    deactivation: { threshold: 28.0, comparison: 'LTE', action: 'TURN_OFF' }
                }),
                actions: JSON.stringify({ device_id: 'FAN_01', activate: 'TURN_ON', deactivate: 'TURN_OFF' }),
                is_enabled: 1,
                min_valid_nodes: 2
            },
            {
                rule_name: 'Tự động cấp ẩm phòng học',
                room_code: 'P.101',
                device_id: 'HUMIDIFIER_01',
                conditions: JSON.stringify({
                    sensor: 'humidity',
                    delay_ms: 5000,
                    activation: { threshold: 50.0, comparison: 'LT', action: 'TURN_ON' },
                    deactivation: { threshold: 60.0, comparison: 'GTE', action: 'TURN_OFF' }
                }),
                actions: JSON.stringify({ device_id: 'HUMIDIFIER_01', activate: 'TURN_ON', deactivate: 'TURN_OFF' }),
                is_enabled: 1,
                min_valid_nodes: 2
            },
            {
                rule_name: 'Tự động đóng/mở rèm cửa theo cường độ ánh sáng',
                room_code: 'P.101',
                device_id: 'CURTAIN_01',
                conditions: JSON.stringify({
                    sensor: 'light',
                    delay_ms: 5000,
                    activation: { threshold: 800, comparison: 'GT', action: 'CLOSE' },
                    deactivation: { threshold: 650, comparison: 'LT', action: 'OPEN' }
                }),
                actions: JSON.stringify({ device_id: 'CURTAIN_01', activate: 'CLOSE', deactivate: 'OPEN' }),
                is_enabled: 1,
                min_valid_nodes: 2
            },
            {
                rule_name: 'Tự động bật/tắt đèn chiếu sáng',
                room_code: 'P.101',
                device_id: 'LIGHT_01',
                conditions: JSON.stringify({
                    sensor: 'light',
                    delay_ms: 5000,
                    activation: { threshold: 300, comparison: 'LT', action: 'TURN_ON' },
                    deactivation: { threshold: 500, comparison: 'GT', action: 'TURN_OFF' }
                }),
                actions: JSON.stringify({ device_id: 'LIGHT_01', activate: 'TURN_ON', deactivate: 'TURN_OFF' }),
                is_enabled: 1,
                min_valid_nodes: 2
            }
        ];

        for (const r of defaultRules) {
            const [existing] = await connection.query(
                'SELECT rule_id FROM automation_rules WHERE room_code = ? AND device_id = ?',
                [r.room_code, r.device_id]
            );
            if (existing.length === 0) {
                await connection.query(
                    `INSERT INTO automation_rules (rule_name, room_code, device_id, conditions, actions, is_enabled, min_valid_nodes)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [r.rule_name, r.room_code, r.device_id, r.conditions, r.actions, r.is_enabled, r.min_valid_nodes]
                );
                console.log(`✅ Seeded rule for device: ${r.device_id}`);
            } else {
                console.log(`ℹ️ Rule already exists for device: ${r.device_id}`);
            }
        }

        console.log('\n🎉 Sync finished successfully!');
    } finally {
        await connection.end();
    }
}

main().catch(err => {
    console.error('Sync failed:', err.message);
    process.exit(1);
});
