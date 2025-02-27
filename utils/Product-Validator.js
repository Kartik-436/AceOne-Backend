const { body, validationResult } = require("express-validator");

const productValidator = [
    // Name validation
    body("name")
        .optional()
        .trim()
        .notEmpty().withMessage("Product name is required")
        .isLength({ min: 2, max: 100 }).withMessage("Product name must be between 2 and 100 characters"),

    // Price validation
    body("price")
        .optional()
        .notEmpty().withMessage("Price is required")
        .isFloat({ min: 0 }).withMessage("Price must be a positive number")
        .custom((value) => {
            if (value === 0) {
                throw new Error("Price cannot be zero");
            }
            return true;
        }),

    // Discount validation
    body("discount")
        .optional()
        .isFloat({ min: 0, max: 100 }).withMessage("Discount must be between 0 and 100")
        .custom((value) => {
            if (value === 100) {
                throw new Error("Discount cannot be 100%");
            }
            return true;
        }),

    // Size validation
    body("size")
        .optional()
        .notEmpty().withMessage("Size is required")
        .isIn(['XS', 'S', 'M', 'L', 'XL', 'XXL']).withMessage("Invalid size. Must be one of: XS, S, M, L, XL, XXL"),

    // Color validation
    body("color")
        .optional()
        .notEmpty().withMessage("Color is required")
        .isString().withMessage("Color must be a string")
        .isLength({ min: 2, max: 20 }).withMessage("Color name must be between 2 and 20 characters"),

    // Category validation
    body("category")
        .optional()
        .notEmpty().withMessage("Category is required")
        .isIn(['Men', 'Women', 'Kids']).withMessage("Invalid category. Must be one of: Men, Women, Kids")
];

module.exports = {
    productValidator,
};