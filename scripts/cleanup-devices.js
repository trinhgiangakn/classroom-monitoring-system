/**
 * Script to clean up duplicate devices on Aiven database.
 * Usage: node scripts/cleanup-devices.js <AIVEN_PASSWORD>
 */
const mysql = require('../backend/node_modules/mysql2/promise');

const AIVEN_HOST = 'mysql-1e258287-intern-phase-2-fpt.j.aivencloud.com';
const AIVEN_PORT = 13334;
const AIVEN_USER = 'avnadmin';
const AIVEN_DB   = 'defaultdb';

async function main() {
    const password = process.argv[2];
    if (!password) {
        console.error('Usage: node scripts/cleanup-devices.js <AIVEN_PASSWORD>');
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
        console.log('Connected to Aiven MySQL. Cleaning up duplicate devices...\n');

        // Delete older duplicate devices if any
        await connection.query(
            "DELETE FROM device_commands WHERE device_id IN ('RELAY_1', 'RELAY_2', 'RELAY_3', 'CURTAIN_MOTOR')"
        );
        await connection.query(
            "DELETE FROM devices WHERE device_id IN ('RELAY_1', 'RELAY_2', 'RELAY_3', 'CURTAIN_MOTOR')"
        );

        // Ensure exactly 4 canonical devices
        const canonical = [
            ['LIGHT_01',      'Đèn chiếu sáng', 'RELAY', 'OFF', 'OFF', 'MANUAL', 'OK', 'OK', 30],
            ['FAN_01',        'Quạt thông gió',  'RELAY', 'OFF', 'OFF', 'MANUAL', 'OK', 'OK', 30],
            ['HUMIDIFIER_01', 'Máy cấp ẩm',      'RELAY', 'OFF', 'OFF', 'MANUAL', 'OK', 'OK', 30],
            ['CURTAIN_01',    'Rèm cửa',          'MOTOR', 'STOPPED', 'STOPPED', 'MANUAL', 'OK', 'OK', 30],
        ];

        for (const [id, name, type, actual, desired, mode, l_open, l_close, timeout] of canonical) {
            await connection.query(
                `INSERT INTO devices (device_id, name, type, actual_state, desired_state, operation_mode, limit_open_status, limit_close_status, timeout_seconds)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE name = VALUES(name), type = VALUES(type), operation_mode = VALUES(operation_mode)`,
                [id, name, type, actual, desired, mode, l_open, l_close, timeout]
            );
        }

        const [rows] = await connection.query('SELECT device_id, name, type, actual_state, operation_mode FROM devices');
        console.log('Current devices in DB:');
        rows.forEach(r => console.log(`  - [${r.type}] ${r.device_id}: ${r.name} (${r.actual_state})`));

        console.log('\n🎉 Devices cleaned up successfully!');
    } finally {
        await connection.end();
    }
}

main().catch(err => {
    console.error('Cleanup failed:', err.message);
    process.exit(1);
});
