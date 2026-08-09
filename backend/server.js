const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: '../.env' });

const app = express();

// Enable CORS so the frontend can call the API without being blocked
app.use(cors());

app.use(express.json());

// Mount authentication routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Load the authentication guard middleware
const { verifyToken } = require('./middleware/authMiddleware');
const { auditLogger } = require('./middleware/auditMiddleware');

// Mount audit logs routes
const auditRoutes = require('./routes/audit');
app.use('/api/audit-logs', auditRoutes);

app.use(auditLogger);

// Mount user management routes
const userRoutes = require('./routes/users');
app.use('/api/users', userRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Backend server is running at: http://localhost:${PORT}`);
});