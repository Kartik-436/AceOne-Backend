const jwt = require('jsonwebtoken');
const sendResponse = require('../utils/Send-Response.js');

async function isLoggedIn(req, res, next) {
    const token = req.cookies.token;

    if (!token) {
        return sendResponse(res, 401, false, "Authentication required. Please log in.");
    }

    try {
        const data = jwt.verify(token, process.env.JWT_SECRET);
        req.user = data;
        next();
    } catch (err) {
        console.error("JWT Verification Error:", err.message);
        return sendResponse(res, 401, false, "Invalid or expired token. Please log in again.");
    }
}

function LogProfileIfCookiePresent(req, res, next) {
    const token = req.cookies.token;

    if (!token) {
        return next();
    }

    try {
        const data = jwt.verify(token, process.env.JWT_SECRET);
        req.user = data;
        return sendResponse(res, 200, true, "Logged in.");
    } catch (err) {
        console.error("JWT Verification Error:", err.message);
        return next();
    }
}

module.exports = { isLoggedIn, LogProfileIfCookiePresent };
