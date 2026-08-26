/**
 * Quick script to run the missing ALTER TABLE on the Aiven cloud database.
 *
 * Usage:
 *   node scripts/migrate-cloud.js <AIVEN_PASSWORD>
 *
 * Example:
 *   node scripts/migrate-cloud.js "myS3cretPass"
 */
const mysql = require('../backend/node_modules/mysql2/promise');

const AIVEN_HOST = 'mysql-1e258287-intern-phase-2-fpt.j.aivencloud.com';
const AIVEN_PORT = 13334;
const AIVEN_USER = 'avnadmin';
const AIVEN_DB   = 'defaultdb';

async function main() {
    const password = process.argv[2];
    if (!password) {
        console.error('Usage: node scripts/migrate-cloud.js <AIVEN_PASSWORD>');
        process.exit(1);
    }

    const connection = await mysql.createConnection({
        host: AIVEN_HOST,
        port: AIVEN_PORT,
        user: AIVEN_USER,
        password: password,
        database: AIVEN_DB,
        ssl: { rejectUnauthorized: false },
    });

    try {
        console.log('Connected to Aiven MySQL. Running migration...\n');

        // Add missing columns to users table (one by one, MySQL 8 lacks IF NOT EXISTS for columns)
        const columnsToAdd = [
            { name: 'is_online', sql: 'ALTER TABLE users ADD COLUMN is_online TINYINT(1) NOT NULL DEFAULT 0' },
            { name: 'last_login', sql: 'ALTER TABLE users ADD COLUMN last_login DATETIME NULL' },
            { name: 'last_active_at', sql: 'ALTER TABLE users ADD COLUMN last_active_at DATETIME NULL' },
        ];

        for (const col of columnsToAdd) {
            try {
                await connection.query(col.sql);
                console.log(`✅ Added column: ${col.name}`);
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME') {
                    console.log(`⏭️  Column ${col.name} already exists, skipping.`);
                } else {
                    throw err;
                }
            }
        }

        // Verify
        const [columns] = await connection.query(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' ORDER BY ORDINAL_POSITION`,
            [AIVEN_DB]
        );
        console.log('\nCurrent users table columns:');
        columns.forEach(c => console.log(`  - ${c.COLUMN_NAME}`));

        console.log('\n🎉 Migration completed successfully!');
    } finally {
        await connection.end();
    }
}

main().catch(err => {
    console.error('Migration failed:', err.message);
    process.exit(1);
});
