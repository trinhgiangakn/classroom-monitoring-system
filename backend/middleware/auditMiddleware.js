const db = require('../config/db');

const SENSITIVE_FIELDS = new Set(['password', 'newPassword', 'token', 'refresh_token']);

// Endpoints that are high-frequency read queries and should not clutter audit logs
const IGNORED_GET_PATTERNS = [
    /^\/api\/sensors/,
    /^\/api\/nodes/,
    /^\/api\/gateway/,
    /^\/api\/audit-logs/,
    /^\/api\/health/,
    /^\/api\/auth\/heartbeat/,
    /^\/api\/devices$/,
    /^\/api\/device-commands/,
];

function safeDetails(body) {
    if (!body || typeof body !== 'object' || Object.keys(body).length === 0) return null;
    return JSON.stringify(Object.fromEntries(
        Object.entries(body).map(([key, value]) => [key, SENSITIVE_FIELDS.has(key) ? '[REDACTED]' : value])
    ));
}

const auditLogger = (req, res, next) => {
    // Skip read-only telemetry/health polling queries
    if (req.method === 'GET' && IGNORED_GET_PATTERNS.some(pat => pat.test(req.originalUrl))) {
        return next();
    }

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
