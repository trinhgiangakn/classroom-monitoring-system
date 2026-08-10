const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// Audit history API (requires a valid token)
router.get('/', verifyToken, requireRole('admin'), async (req, res) => {
    try {
        const [logs] = await db.query(`
            SELECT id, user_id, action, details, created_at 
            FROM audit_logs 
            ORDER BY created_at DESC 
            LIMIT 50
        `);
        
        res.json({
            message: "Audit logs retrieved successfully!",
            total: logs.length,
            data: logs
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
