const db = require('../config/db');

const auditLogger = async (req, res, next) => {
    // Collect information from the request
    // If the request has passed through verifyToken, it will have req.user
    const userId = req.user ? req.user.id : null; 
    
    const action = `${req.method} ${req.originalUrl}`;

    const details = (req.body && Object.keys(req.body).length > 0) 
                        ? JSON.stringify(req.body) : 'No payload data';

    // Write silently to the database
    db.query(
        'INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)',
        [userId, action, details]
    ).catch(err => console.error("Audit log write error:", err.message));

    // Allow the request to continue to the internal API
    next(); 
};

module.exports = { auditLogger };