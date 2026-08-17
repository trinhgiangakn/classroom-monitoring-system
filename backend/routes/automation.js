/**
 * @fileoverview REST API routes for Automation Rules and Sensor Thresholds management.
 */

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const DEVICE_NAME_MAP = {
    FAN_01: 'Quạt thông gió',
    HUMIDIFIER_01: 'Máy cấp ẩm',
    CURTAIN_01: 'Rèm cửa',
    LIGHT_01: 'Đèn chiếu sáng',
};

/**
 * GET /api/automation/rules
 * Retrieve all automation rules for Room P.101.
 */
router.get('/rules', verifyToken, async (req, res) => {
    try {
        const roomId = req.query.room_id || 'P.101';
        const [rows] = await db.query(
            'SELECT rule_id, room_code, rule_name, device_id, conditions, actions, is_enabled, min_valid_nodes FROM automation_rules WHERE room_code = ? ORDER BY rule_id ASC',
            [roomId]
        );

        const rules = rows.map((row) => {
            const conditions = typeof row.conditions === 'string' ? JSON.parse(row.conditions) : (row.conditions || {});
            const actions = typeof row.actions === 'string' ? JSON.parse(row.actions) : (row.actions || {});
            const deviceId = row.device_id;
            const deviceName = DEVICE_NAME_MAP[deviceId] || deviceId;

            let conditionText = row.rule_name;
            if (deviceId === 'FAN_01') {
                conditionText = `BẬT khi nhiệt độ phòng > ${conditions.activation?.threshold ?? 30}°C; TẮT khi <= ${conditions.deactivation?.threshold ?? 28}°C (vùng trễ 2°C)`;
            } else if (deviceId === 'HUMIDIFIER_01') {
                conditionText = `BẬT khi độ ẩm < ${conditions.activation?.threshold ?? 50}%; TẮT khi >= ${conditions.deactivation?.threshold ?? 60}% (vùng trễ 10%)`;
            } else if (deviceId === 'CURTAIN_01') {
                conditionText = `ĐÓNG khi ánh sáng > ${conditions.activation?.threshold ?? 800} lux; MỞ khi < ${conditions.deactivation?.threshold ?? 650} lux`;
            } else if (deviceId === 'LIGHT_01') {
                conditionText = `BẬT khi ánh sáng < ${conditions.activation?.threshold ?? 300} lux; TẮT khi > ${conditions.deactivation?.threshold ?? 500} lux`;
            }

            return {
                id: String(row.rule_id),
                rule_id: row.rule_id,
                device_id: deviceId,
                device: deviceName,
                rule_name: row.rule_name,
                sensor: conditions.sensor || 'temperature',
                condition: conditionText,
                enabled: Boolean(row.is_enabled),
                conditions,
                actions,
                min_valid_nodes: row.min_valid_nodes,
            };
        });

        res.json({ success: true, data: rules });
    } catch (error) {
        console.error('Error in GET /api/automation/rules:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * PUT /api/automation/rules/:id/toggle
 * Toggle enabled state of an automation rule (Admin / Manager only).
 */
router.put('/rules/:id/toggle', verifyToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const ruleId = req.params.id;
        const { enabled } = req.body;

        const [existing] = await db.query('SELECT * FROM automation_rules WHERE rule_id = ?', [ruleId]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy luật tự động' });
        }

        const newEnabled = typeof enabled === 'boolean' ? (enabled ? 1 : 0) : (existing[0].is_enabled ? 0 : 1);
        await db.query('UPDATE automation_rules SET is_enabled = ? WHERE rule_id = ?', [newEnabled, ruleId]);

        const ruleName = existing[0].rule_name || `Luật #${ruleId}`;
        const deviceName = DEVICE_NAME_MAP[existing[0].device_id] || existing[0].device_id;

        await db.query(
            'INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)',
            [
                req.user?.id ?? null,
                'TOGGLE_RULE',
                `${newEnabled ? 'Bật' : 'Tắt'} ${ruleName} (${deviceName})`
            ]
        ).catch(() => {});

        res.json({
            success: true,
            rule_id: ruleId,
            enabled: Boolean(newEnabled),
            message: `Đã ${newEnabled ? 'bật' : 'tắt'} ${ruleName} thành công.`
        });
    } catch (error) {
        console.error('Error in PUT /api/automation/rules/:id/toggle:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/automation/thresholds
 * Retrieve current trigger thresholds for Room P.101.
 */
router.get('/thresholds', verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT device_id, conditions FROM automation_rules WHERE room_code = "P.101"');

        const thresholds = {
            tempOn: 30.0,
            tempOff: 28.0,
            humidityOn: 50.0,
            humidityOff: 60.0,
            lightCurtainClose: 800,
            lightLampOn: 300,
        };

        for (const row of rows) {
            const conditions = typeof row.conditions === 'string' ? JSON.parse(row.conditions) : (row.conditions || {});
            if (row.device_id === 'FAN_01') {
                if (conditions.activation?.threshold !== undefined) thresholds.tempOn = Number(conditions.activation.threshold);
                if (conditions.deactivation?.threshold !== undefined) thresholds.tempOff = Number(conditions.deactivation.threshold);
            } else if (row.device_id === 'HUMIDIFIER_01') {
                if (conditions.activation?.threshold !== undefined) thresholds.humidityOn = Number(conditions.activation.threshold);
                if (conditions.deactivation?.threshold !== undefined) thresholds.humidityOff = Number(conditions.deactivation.threshold);
            } else if (row.device_id === 'CURTAIN_01') {
                if (conditions.activation?.threshold !== undefined) thresholds.lightCurtainClose = Number(conditions.activation.threshold);
            } else if (row.device_id === 'LIGHT_01') {
                if (conditions.activation?.threshold !== undefined) thresholds.lightLampOn = Number(conditions.activation.threshold);
            }
        }

        res.json({ success: true, data: thresholds });
    } catch (error) {
        console.error('Error in GET /api/automation/thresholds:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * PUT /api/automation/thresholds
 * Save trigger thresholds for Room P.101 (Admin / Manager only).
 */
router.put('/thresholds', verifyToken, requireRole('admin', 'manager'), async (req, res) => {
    try {
        const {
            tempOn,
            tempOff,
            humidityOn,
            humidityOff,
            lightCurtainClose,
            lightLampOn,
        } = req.body;

        const [rows] = await db.query('SELECT rule_id, device_id, conditions FROM automation_rules WHERE room_code = "P.101"');

        for (const row of rows) {
            const conditions = typeof row.conditions === 'string' ? JSON.parse(row.conditions) : (row.conditions || {});
            let updated = false;

            if (row.device_id === 'FAN_01') {
                if (tempOn !== undefined) {
                    conditions.activation = { ...conditions.activation, threshold: Number(tempOn), comparison: 'GT', action: 'TURN_ON' };
                    updated = true;
                }
                if (tempOff !== undefined) {
                    conditions.deactivation = { ...conditions.deactivation, threshold: Number(tempOff), comparison: 'LTE', action: 'TURN_OFF' };
                    updated = true;
                }
            } else if (row.device_id === 'HUMIDIFIER_01') {
                if (humidityOn !== undefined) {
                    conditions.activation = { ...conditions.activation, threshold: Number(humidityOn), comparison: 'LT', action: 'TURN_ON' };
                    updated = true;
                }
                if (humidityOff !== undefined) {
                    conditions.deactivation = { ...conditions.deactivation, threshold: Number(humidityOff), comparison: 'GTE', action: 'TURN_OFF' };
                    updated = true;
                }
            } else if (row.device_id === 'CURTAIN_01') {
                if (lightCurtainClose !== undefined) {
                    conditions.activation = { ...conditions.activation, threshold: Number(lightCurtainClose), comparison: 'GT', action: 'CLOSE' };
                    updated = true;
                }
            } else if (row.device_id === 'LIGHT_01') {
                if (lightLampOn !== undefined) {
                    conditions.activation = { ...conditions.activation, threshold: Number(lightLampOn), comparison: 'LT', action: 'TURN_ON' };
                    updated = true;
                }
            }

            if (updated) {
                await db.query('UPDATE automation_rules SET conditions = ? WHERE rule_id = ?', [JSON.stringify(conditions), row.rule_id]);
            }
        }

        await db.query(
            'INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)',
            [
                req.user?.id ?? null,
                'UPDATE_THRESHOLDS',
                `Cập nhật ngưỡng kích hoạt: Quạt(${tempOn ?? '—'}°C/${tempOff ?? '—'}°C), Máy ẩm(${humidityOn ?? '—'}%/${humidityOff ?? '—'}%), Rèm(${lightCurtainClose ?? '—'} lux), Đèn(${lightLampOn ?? '—'} lux)`
            ]
        ).catch(() => {});

        res.json({
            success: true,
            message: 'Đã lưu cấu hình ngưỡng kích hoạt tự động thành công!',
            data: {
                tempOn: Number(tempOn),
                tempOff: Number(tempOff),
                humidityOn: Number(humidityOn),
                humidityOff: Number(humidityOff),
                lightCurtainClose: Number(lightCurtainClose),
                lightLampOn: Number(lightLampOn),
            }
        });
    } catch (error) {
        console.error('Error in PUT /api/automation/thresholds:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
