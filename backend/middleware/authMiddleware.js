const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    // Get the token from the request header
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ message: "Access denied. No authorization token provided!" });

    try {
        // Remove the "Bearer " prefix to get the raw token string
        const actualToken = token.split(" ")[1];
        
        // Decode the token using the secret key
        const decoded = jwt.verify(actualToken, process.env.JWT_SECRET);
        req.user = decoded;
        
        next();
    } catch (err) {
        return res.status(401).json({ message: "Invalid or expired token!" });
    }
};

module.exports = { verifyToken };