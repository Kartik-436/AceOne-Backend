// Required Modules
const express = require('express');

// Required Environment Variables
require('dotenv').config();

// Required Controllers
const {
    getAllProducts,
    getProductById,
    getBestSellingProducts,
    getDiscountedProducts,
    searchProducts
} = require("../controllers/productController");

// Express Router
const router = express.Router();

// Get all products with sorting feature
router.get('/', getAllProducts);

// Get products with discounts
router.get('/discounted', getDiscountedProducts);

// Get best-selling products (MOVE THIS BEFORE THE PRODUCT ID ROUTE)
router.get('/bestSelling', getBestSellingProducts);

// Search products (MOVE THIS BEFORE THE PRODUCT ID ROUTE)
router.get('/search', searchProducts);

// Get single product details (PLACE THIS LAST)
router.get('/:productId', getProductById);

module.exports.productRouter = router;