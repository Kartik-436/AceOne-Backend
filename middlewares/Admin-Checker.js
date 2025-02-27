const jwt = require('jsonwebtoken');
const sendResponse = require('../utils/Send-Response.js');

function isAdmin(req, res, next) {
    const token = req.cookies.token;

    if (!token) {
        return sendResponse(res, 401, false, "Authentication required. Please log in.");
    }

    try {
        const data = jwt.verify(token, process.env.JWT_SECRET);
        req.user = data;

        if (req.user.role !== 'owner') {
            return sendResponse(res, 403, false, "Access denied. Admin privileges required.");
        }

        next(); // ✅ Allow access if authorized
    } catch (err) {
        console.error("JWT Verification Error:", err.message);
        return sendResponse(res, 401, false, "Invalid or expired token. Please log in again.");
    }
}

module.exports = { isAdmin };
