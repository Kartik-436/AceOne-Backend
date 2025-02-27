const { body, validationResult } = require("express-validator");
const sendResponse = require('../utils/Send-Response.js');

// Custom validation rules
const registerValidator = [
    body("fullName")
        .trim()
        .notEmpty().withMessage("Name is required")
        .isLength({ min: 3 }).withMessage("Name must be at least 3 characters long"),

    body("contact")
        .trim()
        .notEmpty().withMessage("Contact is required")
        .isLength({ min: 10, max: 10 }).withMessage("Contact must be 10 digits long")
        .matches(/^[0-9]+$/).withMessage("Contact can only contain numbers"),
        
    body("email")
        .trim()
        .notEmpty().withMessage("Email is required")
        .isEmail().withMessage("Invalid email format"),

    body("password")
        .trim()
        .notEmpty().withMessage("Password is required")
        .isLength({ min: 6 }).withMessage("Password must be at least 6 characters long")
        .matches(/[A-Z]/).withMessage("Password must contain at least one uppercase letter")
        .matches(/[a-z]/).withMessage("Password must contain at least one lowercase letter")
        .matches(/[0-9]/).withMessage("Password must contain at least one number")
        .matches(/[\W_]/).withMessage("Password must contain at least one special character")
];

// Middleware to check validation and return the first error only
const checkValidation = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const firstError = errors.array()[0].msg;
        return sendResponse(res, 400, false, firstError);
    }
    next();
};

module.exports = { registerValidator, checkValidation };
