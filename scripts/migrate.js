const fs = require('fs');
const path = require('path');
const mysql = require('../backend/node_modules/mysql2/promise');
const dotenv = require('../backend/node_modules/dotenv');

const projectRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(projectRoot, '.env'), quiet: true });

function splitSqlStatements(script) {
    const statements = [];
    let delimiter = ';';
    let buffer = '';

    for (const line of script.split(/\r?\n/)) {
        const delimiterMatch = line.match(/^\s*DELIMITER\s+(\S+)\s*$/i);
        if (delimiterMatch) {
            delimiter = delimiterMatch[1];
            continue;
        }

        buffer += `${line}\n`;
        const trimmed = buffer.trimEnd();
        if (trimmed.endsWith(delimiter)) {
            const statement = trimmed.slice(0, -delimiter.length).trim();
            if (statement) statements.push(statement);
            buffer = '';
        }
    }

    if (buffer.trim()) statements.push(buffer.trim());
    return statements;
}

async function executeScript(connection, script) {
    for (const statement of splitSqlStatements(script)) {
        try {
            await connection.query(statement);
        } catch (err) {
            // Ignore duplicate column or key errors if column already exists
            if (['ER_DUP_FIELDNAME', 'ER_DUP_KEYNAME', 'ER_CANT_DROP_FIELD_OR_KEY'].includes(err.code) || err.errno === 1060 || err.errno === 1061) {
                console.log(`  [info] Ignored duplicate column/index: ${err.message}`);
            } else {
                throw err;
            }
        }
    }
}

async function runMigrations({ seed = process.argv.includes('--seed') } = {}) {
    const databaseName = process.env.DB_NAME || 'classroom_monitoring';
    const sslOption = process.env.DB_SSL === 'false' ? undefined : (process.env.DB_HOST?.includes('aivencloud.com') || process.env.DB_SSL === 'true') ? { rejectUnauthorized: false } : undefined;
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        ssl: sslOption,
    });

    try {
        await connection.query(`CREATE DATABASE IF NOT EXISTS ${mysql.escapeId(databaseName)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await connection.query(`USE ${mysql.escapeId(databaseName)}`);
        await connection.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                migration_name VARCHAR(255) NOT NULL PRIMARY KEY,
                applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
            ) ENGINE=InnoDB
        `);

        const migrationsDir = path.join(projectRoot, 'database/mysql/migrations');
        const files = fs.readdirSync(migrationsDir).filter(file => file.endsWith('.sql')).sort();

        for (const file of files) {
            const [applied] = await connection.execute(
                'SELECT migration_name FROM schema_migrations WHERE migration_name = ?',
                [file],
            );
            if (applied.length > 0) continue;

            const script = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
            await executeScript(connection, script);
            await connection.execute('INSERT INTO schema_migrations (migration_name) VALUES (?)', [file]);
            console.log(`Applied migration: ${file}`);
        }

        const dev2Schema = fs.readFileSync(path.join(projectRoot, 'database/mysql/schema.sql'), 'utf8')
            .replace(/^\s*USE\s+classroom_monitoring\s*;\s*$/gim, '');
        await executeScript(connection, dev2Schema);
        console.log('Applied canonical Dev 2 IoT schema.');

        if (seed) {
            await connection.execute(
                `INSERT INTO rooms (room_code, room_name) VALUES ('P.101', 'Phòng P.101')
                 ON DUPLICATE KEY UPDATE room_name = VALUES(room_name)`,
            );
            const seedScript = fs.readFileSync(path.join(projectRoot, 'database/mysql/seed.sql'), 'utf8')
                .replace(/^\s*USE\s+classroom_monitoring\s*;\s*$/gim, '');
            await executeScript(connection, seedScript);
            console.log('Applied demo seed data.');
        }

        console.log(`Database ${databaseName} is up to date.`);
    } finally {
        await connection.end();
    }
}

if (require.main === module) {
    runMigrations().catch(error => {
        console.error('Database migration failed:', error.message);
        process.exitCode = 1;
    });
}

module.exports = { executeScript, runMigrations, splitSqlStatements };
