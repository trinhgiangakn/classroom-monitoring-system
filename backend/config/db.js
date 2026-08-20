const mysql = require('mysql2/promise');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const sslOption = process.env.DB_SSL === 'false' ? undefined : (process.env.DB_HOST?.includes('aivencloud.com') || process.env.DB_SSL === 'true') ? { rejectUnauthorized: false } : undefined;

// Create a Connection Pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'classroom_monitoring',
    ssl: sslOption,
    charset: 'utf8mb4',
    timezone: process.env.DB_TIMEZONE || 'Z',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// MySQL TIMESTAMP values are converted using the session time zone. Keep the
// session and mysql2's `timezone: 'Z'` parser aligned so API dates are true UTC
// instants instead of local wall-clock values incorrectly labelled with `Z`.
pool.on('connection', connection => {
    connection.query("SET time_zone = '+00:00'");
});

async function testConnection() {
    const connection = await pool.getConnection();
    connection.release();
}

module.exports = pool;
module.exports.testConnection = testConnection;
