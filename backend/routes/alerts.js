/**
 * @fileoverview REST API routes for Alerts management.
 */

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken } = require('../middleware/authMiddleware');

/**
 * GET /api/alerts
 * Retrieve list of alerts from the database.
 */
router.get('/', verifyToken, async (req, res) => {
    try {
        const roomId = req.query.room_id || 'P.101';
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

        const [rows] = await db.query(
            `SELECT 
                alert_id AS id,
                room_code,
                alert_type,
                source,
                message,
                severity,
                status,
                is_resolved,
                created_at,
                resolved_at
            FROM alerts
            WHERE room_code = ?
            ORDER BY created_at DESC
            LIMIT ?`,
            [roomId, limit]
        );

        const severityMap = {
            CRITICAL: 'warning',
            HIGH: 'warning',
            WARNING: 'warning',
            MEDIUM: 'info',
            INFO: 'info',
            RESOLVED: 'success',
        };

        const alerts = rows.map((row) => ({
            id: String(row.id),
            title: row.source ? `Cảnh báo ${row.source}` : 'Cảnh báo hệ thống',
            message: row.message,
            severity: row.is_resolved ? 'success' : (severityMap[row.severity] || 'warning'),
            rawSeverity: row.severity,
            source: row.source || 'Hệ thống',
            time: new Intl.DateTimeFormat('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                day: '2-digit',
                month: '2-digit',
            }).format(new Date(row.created_at)),
            createdAt: row.created_at,
            isResolved: Boolean(row.is_resolved),
        }));

        res.json({
            success: true,
            total: alerts.length,
            data: alerts,
        });
    } catch (error) {
        console.error('Error in GET /api/alerts:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * PUT /api/alerts/:id/resolve
 * Mark an alert as resolved / read.
 */
router.put('/:id/resolve', verifyToken, async (req, res) => {
    try {
        const alertId = req.params.id;
        const [result] = await db.query(
            'UPDATE alerts SET is_resolved = 1, status = "RESOLVED", resolved_at = CURRENT_TIMESTAMP, resolved_by = ? WHERE alert_id = ?',
            [req.user?.id ?? null, alertId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy cảnh báo' });
        }

        res.json({ success: true, message: 'Đã đánh dấu xử lý cảnh báo thành công' });
    } catch (error) {
        console.error('Error in PUT /api/alerts/:id/resolve:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
