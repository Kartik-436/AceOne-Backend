const express = require('express');
const upload = require('../configs/Multer-Config.js');
const { registerValidator, checkValidation } = require('../utils/Register-Validator.js');
const { loginValidator } = require('../utils/Login-Validator.js');
const { profileValidator } = require('../utils/Profile-Validator.js');
const { authenticateUser } = require("../middlewares/Login-Checker.js")
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
    verifyPayment,
    cancelOrder,
    getWishlist,
    addToWishlist,
    removeFromWishlist,
    updateCartQuantity,
    searchUsers,
    verifyEmail,
    verifyResetToken,
    resendVerificationOTP,
    clearCart,
    addReview,
    updateReview,
    deleteReview,
    getProductReviews,
    getUserReviews
} = require('../controllers/userController');

const router = express.Router();

// Authentication Routes
router.post('/register', registerValidator, checkValidation, registerUser);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerificationOTP);
router.post('/login', loginValidator, checkValidation, loginLimiter, loginUser);
router.get('/logout', logoutUser);

// Password Reset Routes
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-token', verifyResetToken);
router.put('/reset-password', resetPassword);

// User Search
router.get('/search', searchUsers);

// Profile Routes
router.get('/profile', authenticateUser, getUserProfile);
router.put('/profile', authenticateUser, profileValidator, checkValidation, updateUserProfile);
router.put('/profile/picture', authenticateUser, upload.single('picture'), updateProfilePicture);

// Cart Routes
router.get('/cart', authenticateUser, getUserCart);
router.post('/cart/add', authenticateUser, addToCart);
router.delete('/cart/remove', authenticateUser, removeFromCart);
router.delete('/cart/clear', authenticateUser, clearCart);
router.put('/cart/update', authenticateUser, updateCartQuantity);

// Order Routes
router.get('/orders', authenticateUser, getUserOrders);
router.post('/order', authenticateUser, placeOrder);
router.post('/order/verify-payment', authenticateUser, verifyPayment);
router.post('/order/cancel', authenticateUser, cancelOrder);

// Wishlist Routes
router.get('/wishlist', authenticateUser, getWishlist);
router.post('/wishlist/add', authenticateUser, addToWishlist);
router.post('/wishlist/remove', authenticateUser, removeFromWishlist);

// Review Routes
router.post('/reviews', authenticateUser, addReview);
router.put('/reviews', authenticateUser, updateReview);
router.delete('/reviews', authenticateUser, deleteReview);
router.get('/:productID/reviews', getProductReviews);
router.get('/reviews', authenticateUser, getUserReviews);

module.exports.userRouter = router;