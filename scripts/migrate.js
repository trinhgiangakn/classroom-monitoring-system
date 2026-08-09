const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function runMigrations() {
    console.log('Connecting to MySQL...');
    
    try {
        // Create a connection to MySQL
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASS || '',
            multipleStatements: true 
        });

        const dbName = process.env.DB_NAME || 'room_monitoring';
        
        // Create the database if it does not exist and select it for use
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
        await connection.query(`USE \`${dbName}\``);
        console.log(`Ready to work with database: ${dbName}`);

        // Scan the migrations directory
        const migrationsDir = path.join(__dirname, '../database/mysql/migrations');
        const files = fs.readdirSync(migrationsDir).sort();

        // Iterate through each file and execute the SQL inside
        for (const file of files) {
            if (file.endsWith('.sql')) {
                console.log(`Executing: ${file}...`);
                const filePath = path.join(migrationsDir, file);
                const sql = fs.readFileSync(filePath, 'utf8'); 
                
                await connection.query(sql); 
                console.log('Done!');
            }
        }
        
        console.log('ALL TABLES HAVE BEEN CREATED SUCCESSFULLY!');
        await connection.end(); 
        
    } catch (error) {
        console.error('AN ERROR OCCURRED DURING TABLE CREATION:');
        console.error(error.message);
        process.exit(1);
    }
}

runMigrations();