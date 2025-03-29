const { body, validationResult } = require("express-validator");

const productValidator = [
    // Name validation
    body("name")
        .trim()
        .notEmpty().withMessage("Product name is required")
        .isLength({ min: 2, max: 100 }).withMessage("Product name must be between 2 and 100 characters"),

    // Description validation
    body("description")
        .trim()
        .notEmpty().withMessage("Product description is required"),

    // Brand validation (optional, defaults to AceOne)
    body("brand")
        .optional()
        .isString().withMessage("Brand must be a string"),

    // Price validation
    body("price")
        .notEmpty().withMessage("Price is required")
        .isFloat({ min: 0.01 }).withMessage("Price must be a positive number"),

    // Discount validation
    body("discount")
        .notEmpty().withMessage("Discount is required")
        .isFloat({ min: 0, max: 100 }).withMessage("Discount must be between 0 and 100"),

    // Discount Price validation (optional)
    body("discountPrice")
        .optional()
        .isFloat({ min: 0 }).withMessage("Discounted price must be a positive number"),

    // Size validation (Array of sizes)
    body("size")
        .isArray({ min: 1 }).withMessage("At least one size is required")
        .custom((sizes) => {
            const validSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
            if (!sizes.every(size => validSizes.includes(size))) {
                throw new Error("Invalid size. Must be one of: XS, S, M, L, XL, XXL");
            }
            return true;
        }),

    // Color validation (Array of colors)
    body("color")
        .isArray({ min: 1 }).withMessage("At least one color is required")
        .custom((colors) => {
            if (!colors.every(color => typeof color === 'string' && color.length >= 2 && color.length <= 20)) {
                throw new Error("Each color must be a string between 2 and 20 characters");
            }
            return true;
        }),

    // Category validation
    body("category")
        .notEmpty().withMessage("Category is required")
        .customSanitizer(value => {
            // Capitalize first letter
            return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
        })
        .isIn(['Men', 'Women', 'Kids']).withMessage("Invalid category. Must be one of: Men, Women, Kids"),

    // Stock validation
    body("stock")
        .notEmpty().withMessage("Stock is required")
        .isInt({ min: 0 }).withMessage("Stock must be a non-negative integer"),

    // Ratings validation (optional, defaults to 0)
    body("ratings")
        .optional()
        .isFloat({ min: 0, max: 5 }).withMessage("Ratings must be between 0 and 5"),

    // Reviews validation (optional array of objects)
    body("reviews")
        .optional()
        .isArray().withMessage("Reviews must be an array")
        .custom((reviews) => {
            for (const review of reviews) {
                if (!review.user || !review.rating || !review.comment) {
                    throw new Error("Each review must have a user, rating, and comment");
                }
                if (typeof review.rating !== 'number' || review.rating < 0 || review.rating > 5) {
                    throw new Error("Review rating must be between 0 and 5");
                }
            }
            return true;
        })
];

module.exports = {
    productValidator,
};
