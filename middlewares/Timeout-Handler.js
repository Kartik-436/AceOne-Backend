const timeout = require('express-timeout-handler');
const sendResponse = require('../utils/Send-Response.js');

// Export the timeout middleware directly
module.exports = timeout.handler({
    timeout: 30000,
    onTimeout: function (req, res) {
        sendResponse(res, 503, false, 'Request timed out');
    }
});
