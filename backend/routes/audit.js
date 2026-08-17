const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// Audit history API (requires a valid token)
router.get('/', verifyToken, requireRole('admin'), async (req, res) => {
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
        const [logs] = await db.query(`
            SELECT 
                a.id, 
                a.user_id, 
                COALESCE(u.username, IF(a.user_id IS NOT NULL, CONCAT('User #', a.user_id), 'System')) AS username,
                u.full_name,
                u.role,
                a.action, 
                a.details, 
                a.created_at 
            FROM audit_logs a
            LEFT JOIN users u ON a.user_id = u.id
            ORDER BY a.created_at DESC 
            LIMIT ?
        `, [limit]);
        
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
