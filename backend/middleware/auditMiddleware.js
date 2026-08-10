const db = require('../config/db');

const SENSITIVE_FIELDS = new Set(['password', 'newPassword', 'token', 'refresh_token']);

function safeDetails(body) {
    if (!body || typeof body !== 'object' || Object.keys(body).length === 0) return null;
    return JSON.stringify(Object.fromEntries(
        Object.entries(body).map(([key, value]) => [key, SENSITIVE_FIELDS.has(key) ? '[REDACTED]' : value])
    ));
}

const auditLogger = (req, res, next) => {
    res.once('finish', () => {
        const userId = req.user?.id ?? null;
        const action = `${req.method} ${req.originalUrl}`;
        const details = safeDetails(req.body);

        db.query(
            'INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)',
            [userId, action, details]
        ).catch(err => console.error('Audit log write error:', err.message));
    });

    next();
};

module.exports = { auditLogger };
