const { body, validationResult } = require("express-validator");

// Custom validation rules
const profileValidator = [
    body("fullName")
        .optional()
        .trim()
        .notEmpty().withMessage("Name is required")
        .isLength({ min: 3 }).withMessage("Name must be at least 3 characters long"),

    body("contact")
        .optional()
        .trim()
        .notEmpty().withMessage("contact is required")
        .isLength({ min: 10, max: 10 }).withMessage("Contact must be 10 digits long")
        .matches(/^[0-9]+$/).withMessage("Contact can only contain numbers"),
        
    body("email")
        .optional()
        .trim()
        .notEmpty().withMessage("Email is required")
        .isEmail().withMessage("Invalid email format"),

    body("dateOfBirth")
        .optional()
        .trim()
        .notEmpty().withMessage("Date of Birth is required")
        .isDate().withMessage("Invalid date format"),
    
    body("gstNo")
        .optional()
        .trim()
        .notEmpty().withMessage("GST No is required")
        .isLength({ min: 15, max: 15 }).withMessage("GST No must be 15 characters long")
        .matches(/^[0-9]+$/).withMessage("GST No can only contain numbers"),
];

module.exports = { profileValidator };
