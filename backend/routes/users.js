const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const { auditLogger } = require('../middleware/auditMiddleware');

router.use(verifyToken, requireRole('admin'), auditLogger);

// 1. Get user list (only safe columns)
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT id, username, role, created_at FROM users');
        res.json({ data: rows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Update user role
router.put('/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const { role } = req.body;

        if (!['admin', 'technician', 'user'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role.' });
        }

        const [targetUser] = await db.query('SELECT username FROM users WHERE id = ?', [userId]);
        if (targetUser[0]?.username === 'baokhanhdtm' && role !== 'admin') {
            return res.status(400).json({ error: 'Không thể hạ quyền tài khoản Quản trị viên gốc (baokhanhdtm)!' });
        }

        const [result] = await db.query(
            'UPDATE users SET role = ? WHERE id = ?',
            [role, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found!' });
        }

        res.json({ message: 'User role updated successfully!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Delete user
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.params.id;

        const [targetUser] = await db.query('SELECT username FROM users WHERE id = ?', [userId]);
        if (targetUser[0]?.username === 'baokhanhdtm') {
            return res.status(400).json({ error: 'Không thể xóa tài khoản Quản trị viên gốc (baokhanhdtm)!' });
        }

        const [result] = await db.query('DELETE FROM users WHERE id = ?', [userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found!' });
        }

        res.json({ message: 'User deleted successfully!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
