const db = require('../../config/db');

async function testSecurityFlow() {
    console.log("STARTING JWT + AUDIT LOGS SECURITY TEST...\n");

    try {
        // 1. Call registration endpoint
        console.log("Registering admin account...");
        const regRes = await fetch('http://127.0.0.1:3000/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin_test', password: 'password123', role: 'ADMIN' })
        });
        const regData = await regRes.json();
        console.log('   Registration response:', regData);

        // 2. Call login endpoint
        console.log("\nLogging in to obtain JWT...");
        const loginRes = await fetch('http://127.0.0.1:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin_test', password: 'password123' })
        });
        const loginData = await loginRes.json();

        if (!loginData.token) {
            console.error('Login failed. Server response:', loginData);
            return;
        }

        const token = loginData.token;
        console.log('Login successful. Received token:\n ' + token.substring(0, 50) + '...\n');

        // 3. Call protected users endpoint
        console.log('Accessing /api/users with the obtained token...');
        const usersRes = await fetch('http://127.0.0.1:3000/api/users', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const usersData = await usersRes.json();
        console.log('Protected endpoint succeeded. Access granted.');
        console.log(`Found ${usersData.data?.length || 0} users.\n`);

        // 4. Inspect audit logs in the database
        console.log('Checking audit log entries in the database...');
        const [logs] = await db.query('SELECT action, details, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 2');
        console.table(logs);

    } catch (error) {
        console.error('Error during execution:', error.message);
    } finally {
        // Close the DB connection gracefully instead of process.exit()
        db.end();
    }
}

testSecurityFlow();