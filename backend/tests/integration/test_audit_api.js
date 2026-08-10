async function testAuditLogs() {
    console.log('STARTING AUDIT LOGS API TEST...\n');

    try {
        // 1. Login to get a JWT token
        console.log('Logging in with admin_test account...');
        const loginRes = await fetch('http://127.0.0.1:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin_test', password: 'password123' })
        });
        const loginData = await loginRes.json();

        if (!loginData.token) {
            console.error('Login failed:', loginData);
            return;
        }

        const token = loginData.token;
        console.log('Token acquired successfully.\n');

        // 2. Call audit history endpoint with the token
        console.log('Requesting GET /api/audit-logs...');
        const auditRes = await fetch('http://127.0.0.1:3000/api/audit-logs', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const auditData = await auditRes.json();

        // 3. Print the results
        console.log('\nSERVER RESPONSE:');
        console.log(`Total records found: ${auditData.total}`);

        if (auditData.data && auditData.data.length > 0) {
            console.log('Most recent 5 actions:');
            console.table(auditData.data.slice(0, 5));
        } else {
            console.log('No audit log entries found.');
        }

    } catch (error) {
        console.error('Error encountered:', error.message);
    }
}

testAuditLogs();