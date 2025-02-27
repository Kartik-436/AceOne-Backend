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
const { } = require('../middlewares/Login-Checker.js');
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

// Owner Profile Route
router.get('/profile', isAdmin, getOwnerProfile);

// Owner Update Profile Route
router.put('/profile', isAdmin, profileValidator, checkValidation, upload.single("picture"), updateOwnerProfile);

// Owner Delete Profile Route
if (process.env.NODE_ENV === 'development') {
    router.delete('/profile', isAdmin, deleteOwner);
}

// Owner Add Product Route
router.post('/add-product', isAdmin, productValidator, checkValidation, upload.single("image"), addProduct);

// Owner Update Product Route
router.put('/update-product/:id', isAdmin, productValidator, checkValidation, upload.single("image"), updateProduct);

// Owner Delete Product Route
router.delete('/delete-product/:id', isAdmin, deleteProduct);

// Owner Get All Products Route
router.get('/all-products', isAdmin, getAllProducts);

// Owner Get Single Product Route
router.get('/product/:id', isAdmin, getProductById);

// Owner Get All Users Route
router.get('/all-users', isAdmin, getAllUsers);

// Owner Get Single User Route
router.get('/user/:id', isAdmin, getSingleUser);

// Owner Delete User Route
router.delete('/delete-user/:id', isAdmin, deleteUser);

// Owner Apply Discount Route
router.put('/apply-discount/:id', isAdmin, productValidator, checkValidation, applyDiscount);

// Owner Remove Discount Route
router.put('/remove-discount/:id', isAdmin, removeDiscount);

// Owner Get All Orders Route
router.get('/all-orders', isAdmin, getAllOrders);

// Owner Get Single Order Route
router.get('/order/:id', isAdmin, getSingleOrder);

// Owner can cancel an order
router.delete('/cancel-order/:id', isAdmin, deleteOrder);

// Owner get sales and revenue data
router.get('/sales', isAdmin, getRevenueStats);

module.exports.ownerRouter = router;
