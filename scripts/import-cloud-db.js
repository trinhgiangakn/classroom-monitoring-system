/**
 * Imports all database migrations, schema, and seed data to Aiven Cloud MySQL.
 * Usage: node scripts/import-cloud-db.js <host> <port> <user> <password> <database>
 */

const path = require('path');
const mysql = require('../backend/node_modules/mysql2/promise');
const { executeScript, splitSqlStatements } = require('./migrate');
const fs = require('fs');

async function importCloudDb() {
  const args = process.argv.slice(2);
  const host = args[0] || 'mysql-1e258287-intern-phase-2-fpt.j.aivencloud.com';
  const port = Number(args[1] || 13334);
  const user = args[2] || 'avnadmin';
  const password = args[3] || 'AVNS_HaBZ4yKve_rzXpahOIq';
  const database = args[4] || 'defaultdb';

  console.log(`📡 Connecting to Aiven Cloud MySQL: ${host}:${port} (${database})...`);

  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('✅ Connected successfully!');

    // 1. Create schema_migrations table if not exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        migration_name VARCHAR(255) NOT NULL PRIMARY KEY,
        applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
      ) ENGINE=InnoDB
    `);

    // 2. Run all migration files
    const migrationsDir = path.join(__dirname, '../database/mysql/migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
      const [applied] = await connection.execute(
        'SELECT migration_name FROM schema_migrations WHERE migration_name = ?',
        [file]
      );
      if (applied.length > 0) continue;

      const script = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await executeScript(connection, script);
      await connection.execute('INSERT INTO schema_migrations (migration_name) VALUES (?)', [file]);
      console.log(`  ✓ Applied migration: ${file}`);
    }

    // 3. Apply canonical Dev 2 IoT schema
    const dev2Schema = fs.readFileSync(path.join(__dirname, '../database/mysql/schema.sql'), 'utf8')
      .replace(/^\s*USE\s+[^\s;]+\s*;\s*$/gim, '');
    await executeScript(connection, dev2Schema);
    console.log('  ✓ Applied canonical Dev 2 IoT schema.');

    // 4. Ensure room P.101 & Seed data
    await connection.execute(
      `INSERT INTO rooms (room_code, room_name) VALUES ('P.101', 'Phòng P.101')
       ON DUPLICATE KEY UPDATE room_name = VALUES(room_name)`
    );

    const seedScript = fs.readFileSync(path.join(__dirname, '../database/mysql/seed.sql'), 'utf8')
      .replace(/^\s*USE\s+[^\s;]+\s*;\s*$/gim, '');
    await executeScript(connection, seedScript);
    console.log('  ✓ Applied demo seed data.');

    console.log('\n🎉 ALL CLOUD DATABASE TABLES & SEED DATA IMPORTED SUCCESSFULLY!');

  } catch (error) {
    console.error('❌ Import failed:', error.message);
  } finally {
    await connection.end();
  }
}

importCloudDb();
