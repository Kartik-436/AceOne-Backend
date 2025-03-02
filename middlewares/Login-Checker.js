const jwt = require('jsonwebtoken');
const sendResponse = require('../utils/Send-Response.js');

async function authenticateUser(req, res, next) {
    const token = req.cookies.token;
    const sessionId = req.cookies.sessionId;

    if (token) {
        try {
            const data = jwt.verify(token, process.env.JWT_SECRET);
            req.user = data;
        } catch (err) {
            req.cookies.token = null;

            if (!sessionId) {
                req.sessionId = Math.random().toString(36).substring(2);
                res.cookie("sessionId", req.sessionId, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });
            } else {
                req.sessionId = sessionId;
            }
        }
    } else if (sessionId) {
        req.sessionId = sessionId;
    } else {
        req.sessionId = Math.random().toString(36).substring(2);
        res.cookie("sessionId", req.sessionId, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });
    }

    next();
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

module.exports = { authenticateUser, LogProfileIfCookiePresent };
