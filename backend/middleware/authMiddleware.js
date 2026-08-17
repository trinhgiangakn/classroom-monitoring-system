const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const authorization = req.get('authorization');
    if (!authorization) {
        return res.status(401).json({ message: 'Access denied. No authorization token provided.' });
    }

    const [scheme, token] = authorization.trim().split(/\s+/);
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
        return res.status(401).json({ message: 'Authorization must use the Bearer scheme.' });
    }

    if (!process.env.JWT_SECRET) {
        return res.status(500).json({ message: 'Authentication is not configured.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token.' });
    }
};

const requireRole = (...roles) => (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Access denied. No user information in token.' });
    }
    const userRole = (req.user.role || '').toLowerCase();
    const username = (req.user.username || '').toLowerCase();
    const email = (req.user.email || '').toLowerCase();
    const isRootAdmin = username === 'baokhanhdtm' || email.startsWith('baokhanh');
    const normalizedRoles = roles.map(r => r.toLowerCase());

    // Root admin or admin/manager always has full access to admin endpoints
    if (isRootAdmin || userRole === 'admin' || userRole === 'manager' || normalizedRoles.includes(userRole)) {
        return next();
    }

    return res.status(403).json({ message: 'You do not have permission to perform this action.' });
};

module.exports = { verifyToken, requireRole };
