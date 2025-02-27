const express = require('express');
const upload = require('../configs/Multer-Config.js');
const { registerValidator, checkValidation } = require('../utils/Register-Validator.js');
const { loginValidator } = require('../utils/Login-Validator.js');
const { profileValidator } = require('../utils/Profile-Validator.js');
const { isLoggedIn } = require('../middlewares/Login-Checker.js');
require('dotenv').config();

const {
    loginLimiter,
    registerUser,
    loginUser,
    logoutUser,
    forgotPassword,
    resetPassword,
    getUserProfile,
    updateUserProfile,
    updateProfilePicture,
    getUserCart,
    addToCart,
    removeFromCart,
    getUserOrders,
    placeOrder,
    cancelOrder,
    getWishlist,
    addToWishlist,
    removeFromWishlist,
    updateCartQuantity
} = require('../controllers/userController');

const router = express.Router();

// User Routes
router.post('/register', registerValidator, checkValidation, registerUser);
router.post('/login', loginValidator, checkValidation, loginLimiter, loginUser);
router.get('/logout', logoutUser); // Changed from POST to GET to match controller
// router.post('/forgot-password', forgotPassword);
router.put('/reset-password', resetPassword); // Removed isLoggedIn as it's for password reset

// Profile Routes
router.get('/profile', isLoggedIn, getUserProfile);
router.put('/profile', isLoggedIn, profileValidator, checkValidation, updateUserProfile); // Changed from /profile/update to /profile
router.put('/profile/picture', isLoggedIn, upload.single('picture'), updateProfilePicture); // Changed profilePicture to picture to match controller

// Cart Routes
router.get('/cart', getUserCart); // Removed isLoggedIn as cart works for both logged-in and guest users
router.post('/cart/add', addToCart); // Changed from PUT to POST and removed :productId as it's in body
router.delete('/cart/remove', removeFromCart); // Changed from DELETE to POST and removed :productId as it's in body
router.put('/cart/update', updateCartQuantity);

// Order Routes
router.get('/orders', isLoggedIn, getUserOrders);
router.post('/order/place', isLoggedIn, placeOrder); // Added /place for clarity
router.post('/order/cancel', isLoggedIn, cancelOrder); // Changed from DELETE to POST and removed :orderId as it's in body

// Wishlist Routes
router.get('/wishlist', isLoggedIn, getWishlist);
router.post('/wishlist/add', isLoggedIn, addToWishlist); // Changed from PUT to POST and removed :productId
router.post('/wishlist/remove', isLoggedIn, removeFromWishlist);

module.exports.userRouter = router;