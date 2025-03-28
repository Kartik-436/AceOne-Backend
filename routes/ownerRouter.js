// Required Modules
const express = require('express');

// Required Configs
const upload = require('../configs/Multer-Config.js');

// Required utilities
const { registerValidator, checkValidation } = require('../utils/Register-Validator.js');
const { loginValidator } = require('../utils/Login-Validator.js');
const { productValidator } = require('../utils/Product-Validator.js');
const { profileValidator } = require('../utils/Profile-Validator.js');

// Required Middlewares
const { isAdmin } = require('../middlewares/Admin-Checker.js');

// Required Environment Variables
require('dotenv').config();

// Required Controllers
const {
    loginLimiter,
    registerOwner,
    loginOwner,
    logOutOwner,
    getOwnerProfile,
    updateOwnerProfile,
    deleteOwner,
    addProduct,
    getAllProducts,
    getProductById,
    updateProduct,
    deleteProduct,
    getAllUsers,
    getSingleUser,
    deleteUser,
    applyDiscount,
    removeDiscount,
    getAllOrders,
    getSingleOrder,
    deleteOrder,
    getRevenueStats,
} = require("../controllers/ownerController");

// Express Router
const router = express.Router();

// Owner Register Route
if (process.env.NODE_ENV === 'development') {
    router.post('/register', registerValidator, checkValidation, registerOwner);
}

// Owner Login Route
router.post('/login', loginValidator, checkValidation, loginLimiter, loginOwner);

// Owner Logout Route
router.get('/logout', isAdmin, logOutOwner);

// Owner Profile Routes
router.route('/profile')
    .get(isAdmin, getOwnerProfile)
    .put(isAdmin, profileValidator, checkValidation, upload.single("picture"), updateOwnerProfile)
    .delete(isAdmin, deleteOwner);

// Product Routes
router.route('/products')
    .post(isAdmin, productValidator, checkValidation,
        upload.fields([
            { name: 'image', maxCount: 1 },
            { name: 'additionalImages', maxCount: 5 }
        ]), addProduct)
    .get(isAdmin, getAllProducts);

router.route('/products/:id')
    .get(isAdmin, getProductById)
    .put(isAdmin, productValidator, checkValidation,
        upload.fields([
            { name: 'image', maxCount: 1 },
            { name: 'additionalImages', maxCount: 5 }
        ]), updateProduct)
    .delete(isAdmin, deleteProduct);

// Discount Routes
router.put('/products/:id/apply-discount', isAdmin, productValidator, checkValidation, applyDiscount);
router.put('/products/:id/remove-discount', isAdmin, removeDiscount);

// User Routes
router.route('/users')
    .get(isAdmin, getAllUsers);

router.route('/users/:id')
    .get(isAdmin, getSingleUser)
    .delete(isAdmin, deleteUser);

// Order Routes
router.route('/orders')
    .get(isAdmin, getAllOrders);

router.route('/orders/:id')
    .get(isAdmin, getSingleOrder)
    .delete(isAdmin, deleteOrder);

// Sales and Revenue Route
router.get('/sales', isAdmin, getRevenueStats);

module.exports.ownerRouter = router;