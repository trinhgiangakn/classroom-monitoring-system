/**
 * Seed devices table on Aiven cloud.
 * Usage: node scripts/seed-devices-cloud.js <AIVEN_PASSWORD>
 */
const mysql = require('../backend/node_modules/mysql2/promise');

const AIVEN_HOST = 'mysql-1e258287-intern-phase-2-fpt.j.aivencloud.com';
const AIVEN_PORT = 13334;
const AIVEN_USER = 'avnadmin';
const AIVEN_DB   = 'defaultdb';

async function main() {
    const password = process.argv[2];
    if (!password) {
        console.error('Usage: node scripts/seed-devices-cloud.js <AIVEN_PASSWORD>');
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
        console.log('Connected to Aiven MySQL. Seeding devices...\n');

        // Insert 4 devices: 3 RELAYs + 1 MOTOR (rèm cửa)
        const devices = [
            ['RELAY_1',       'Đèn chiếu sáng',  'RELAY', 'OFF', 'OFF', 'MANUAL'],
            ['RELAY_2',       'Quạt thông gió',   'RELAY', 'OFF', 'OFF', 'MANUAL'],
            ['RELAY_3',       'Máy cấp ẩm',       'RELAY', 'OFF', 'OFF', 'MANUAL'],
            ['CURTAIN_MOTOR', 'Rèm cửa',           'MOTOR', 'STOPPED', 'STOPPED', 'MANUAL'],
        ];

        for (const [device_id, name, type, actual_state, desired_state, operation_mode] of devices) {
            await connection.query(
                `INSERT INTO devices (device_id, name, type, actual_state, desired_state, operation_mode)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE name = VALUES(name), type = VALUES(type)`,
                [device_id, name, type, actual_state, desired_state, operation_mode]
            );
            console.log(`✅ Seeded device: ${device_id} — ${name}`);
        }

        // Verify
        const [rows] = await connection.query('SELECT device_id, name, type, actual_state, operation_mode FROM devices');
        console.log('\nCurrent devices in DB:');
        rows.forEach(r => console.log(`  - [${r.type}] ${r.device_id}: ${r.name} (${r.actual_state}, mode: ${r.operation_mode})`));

        console.log('\n🎉 Devices seeded successfully!');
    } finally {
        await connection.end();
    }
}

main().catch(err => {
    console.error('Seed failed:', err.message);
    process.exit(1);
});
