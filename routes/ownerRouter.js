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
    .post(isAdmin,
        // First handle file uploads
        upload.fields([
            { name: 'image', maxCount: 1 },
            { name: 'additionalImages', maxCount: 5 }
        ]),
        // Parse comma-separated strings into arrays
        (req, res, next) => {
            console.log("🔥 Debugging Product Upload:");
            console.log("Body:", req.body);
            console.log("Files:", req.files);

            // Convert comma-separated strings to arrays
            if (req.body.size && typeof req.body.size === 'string') {
                req.body.size = req.body.size.split(',').map(item => item.trim());
            }

            if (req.body.color && typeof req.body.color === 'string') {
                req.body.color = req.body.color.split(',').map(item => item.trim());
            }

            next();
        },
        productValidator,
        checkValidation,
        addProduct)
    .get(isAdmin, getAllProducts);

router.route('/products/:id')
    .get(isAdmin, getProductById)
    .put(isAdmin,
        upload.fields([
            { name: 'image', maxCount: 1 },
            { name: 'additionalImages', maxCount: 5 }
        ]),
        productValidator, checkValidation, updateProduct)
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

router.post('/test', upload.none(), (req, res) => {
    console.log("Test Body:", req.body);
    res.json({ success: true, receivedBody: req.body });
});


// Sales and Revenue Route
router.get('/sales', isAdmin, getRevenueStats);

module.exports.ownerRouter = router;