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
    timezone: process.env.DB_TIMEZONE || '+07:00',
    waitForConnections: true,
    connectionLimit: 5,        // Aiven free tier: giới hạn số kết nối đồng thời
    queueLimit: 0,
    connectTimeout: 15000,     // 15s timeout khi tạo kết nối mới
    enableKeepAlive: true,     // Gửi keepalive packet để Aiven không đóng idle connection
    keepAliveInitialDelay: 30000, // Gửi keepalive sau 30s idle
});

async function testConnection() {
    const connection = await pool.getConnection();
    connection.release();
}

module.exports = pool;
module.exports.testConnection = testConnection;
