const multer = require("multer");

const storage = multer.memoryStorage(); // or use diskStorage
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

module.exports = upload;
