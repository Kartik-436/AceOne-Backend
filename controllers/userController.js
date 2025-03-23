const ProductModel = require('../models/product.js');
const UserModel = require('../models/user.js');
const OrderModel = require('../models/order.js');
const wishModel = require('../models/wishlist.js');
const CartModel = require('../models/cart.js')
const PaymentModel = require("../models/payment.js")
const InvoiceModel = require("../models/invoice.js")
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const nodemailer = require("nodemailer")
const sendResponse = require('../utils/Send-Response.js');
const {
    createOrder: createRazorpayOrder,
    capturePayment,
    processRefund
} = require('../services/PaymentService.jsx');
const { generateInvoice } = require('../utils/Generate-Invoice.js');
require('dotenv').config();

const dbgr = require('debug')('development:userController');

const loginLimiter = rateLimit({
    windowMs: 12 * 60 * 1000,
    max: 6,
    message: "Too many login attempts, please try again later."
});

// Send verification email
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.MAIL,
        pass: process.env.MAIL_PASS
    }
});

async function registerUser(req, res) {
    try {
        const { fullName, email, password, contact, dateOfBirth } = req.body;
        const user = await UserModel.findOne({ email });

        // Check if user exists and is verified
        if (user && user.isVerified) {
            return sendResponse(res, 400, false, "User already exists with this email.");
        }

        // Email validation with regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return sendResponse(res, 400, false, "Invalid email format.");
        }

        // Generate verification token (OTP)
        const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
        const verificationTokenExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        const hashedPassword = await bcrypt.hash(password, 10);

        // If user exists but not verified, update their information
        if (user) {
            user.fullName = fullName;
            user.password = hashedPassword;
            user.contact = contact;
            user.dateOfBirth = new Date(dateOfBirth);
            user.verificationToken = verificationToken;
            user.verificationTokenExpires = verificationTokenExpires;
            await user.save();
        } else {
            // Create new user
            const newUser = new UserModel({
                fullName,
                email,
                password: hashedPassword,
                contact,
                dateOfBirth: new Date(dateOfBirth),
                verificationToken,
                verificationTokenExpires,
                isVerified: false
            });
            await newUser.save();
        }

        const mailOptions = {
            from: process.env.MAIL,
            to: email,
            subject: 'Email Verification for Your Account',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Email Verification</title>
                    <style>
                        body {
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                            line-height: 1.6;
                            color: #333333;
                            margin: 0;
                            padding: 0;
                        }
                        .container {
                            max-width: 600px;
                            margin: 0 auto;
                            padding: 20px;
                        }
                        .header {
                            background-color: #4A90E2;
                            padding: 20px;
                            text-align: center;
                            color: white;
                            border-radius: 5px 5px 0 0;
                        }
                        .content {
                            background-color: #ffffff;
                            padding: 30px;
                            border-left: 1px solid #e6e6e6;
                            border-right: 1px solid #e6e6e6;
                        }
                        .verification-code {
                            font-size: 32px;
                            font-weight: bold;
                            text-align: center;
                            letter-spacing: 5px;
                            margin: 20px 0;
                            padding: 15px;
                            background-color: #f7f7f7;
                            border-radius: 5px;
                            color: #333333;
                        }
                        .expiry-notice {
                            text-align: center;
                            color: #777777;
                            font-size: 14px;
                            margin-top: 20px;
                        }
                        .footer {
                            background-color: #f7f7f7;
                            padding: 15px;
                            text-align: center;
                            font-size: 12px;
                            color: #777777;
                            border-radius: 0 0 5px 5px;
                            border: 1px solid #e6e6e6;
                        }
                        .button {
                            display: inline-block;
                            background-color: #4A90E2;
                            color: white;
                            text-decoration: none;
                            padding: 10px 20px;
                            border-radius: 5px;
                            margin-top: 15px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Email Verification</h1>
                        </div>
                        <div class="content">
                            <p>Hello,</p>
                            <p>Thank you for registering with our e-commerce platform. To complete your registration, please use the verification code below:</p>
                            
                            <div class="verification-code">
                                ${verificationToken}
                            </div>
                            
                            <p>Please enter this code on the verification page to activate your account.</p>
                            
                            <p class="expiry-notice">This code will expire in <strong>10 minutes</strong>.</p>
                            
                            <p>If you did not request this verification code, please ignore this email.</p>
                        </div>
                        <div class="footer">
                            <p>&copy; 2025 Aceone. All rights reserved.</p>
                            <p>This is an automated message, please do not reply to this email.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        await transporter.sendMail(mailOptions);

        return sendResponse(res, 201, true, "User registered successfully. Please check your email for verification code.", { email });
    } catch (err) {
        dbgr("Register User Error:", err.message);
        return sendResponse(res, 500, false, "Something went wrong.");
    }
}

async function verifyEmail(req, res) {
    try {
        let { OTP_Email } = req.body;

        let finalEmail = OTP_Email.email.email;
        let otp = OTP_Email.otp;

        const user = await UserModel.findOne({
            email: finalEmail,
            verificationToken: otp,
            verificationTokenExpires: { $gt: Date.now() }
        });

        if (!user) {
            return sendResponse(res, 400, false, "Invalid or expired verification code.");
        }

        // Mark user as verified
        user.isVerified = true;
        user.verificationToken = undefined;
        user.verificationTokenExpires = undefined;
        await user.save();

        // Generate JWT token after verification
        const token = jwt.sign(
            { email: user.email, ID: user._id, role: "user" },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: true,
            sameSite: "None",
            maxAge: 24 * 60 * 60 * 1000
        });

        const userResponse = await UserModel.findById(user._id).select('-password -verificationToken -verificationTokenExpires');

        return sendResponse(res, 200, true, "Email verified successfully. You are now logged in.", userResponse);
    } catch (err) {
        dbgr("Verification Error:", err.message);
        return sendResponse(res, 500, false, "Something went wrong during verification.");
    }
}

async function resendVerificationOTP(req, res) {
    try {
        const { email } = req.body;

        const user = await UserModel.findOne({ email });

        if (!user) {
            return sendResponse(res, 404, false, "User not found with this email.");
        }

        if (user.isVerified) {
            return sendResponse(res, 400, false, "Email already verified. Please login.");
        }

        // Generate new verification token
        const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
        const verificationTokenExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        user.verificationToken = verificationToken;
        user.verificationTokenExpires = verificationTokenExpires;
        await user.save();

        const mailOptions = {
            from: process.env.MAIL,
            to: email,
            subject: 'Email Verification for Your Account',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Email Verification</title>
                    <style>
                        body {
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                            line-height: 1.6;
                            color: #333333;
                            margin: 0;
                            padding: 0;
                        }
                        .container {
                            max-width: 600px;
                            margin: 0 auto;
                            padding: 20px;
                        }
                        .header {
                            background-color: #4A90E2;
                            padding: 20px;
                            text-align: center;
                            color: white;
                            border-radius: 5px 5px 0 0;
                        }
                        .content {
                            background-color: #ffffff;
                            padding: 30px;
                            border-left: 1px solid #e6e6e6;
                            border-right: 1px solid #e6e6e6;
                        }
                        .verification-code {
                            font-size: 32px;
                            font-weight: bold;
                            text-align: center;
                            letter-spacing: 5px;
                            margin: 20px 0;
                            padding: 15px;
                            background-color: #f7f7f7;
                            border-radius: 5px;
                            color: #333333;
                        }
                        .expiry-notice {
                            text-align: center;
                            color: #777777;
                            font-size: 14px;
                            margin-top: 20px;
                        }
                        .footer {
                            background-color: #f7f7f7;
                            padding: 15px;
                            text-align: center;
                            font-size: 12px;
                            color: #777777;
                            border-radius: 0 0 5px 5px;
                            border: 1px solid #e6e6e6;
                        }
                        .button {
                            display: inline-block;
                            background-color: #4A90E2;
                            color: white;
                            text-decoration: none;
                            padding: 10px 20px;
                            border-radius: 5px;
                            margin-top: 15px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Email Verification</h1>
                        </div>
                        <div class="content">
                            <p>Hello,</p>
                            <p>Thank you for registering with our e-commerce platform. To complete your registration, please use the verification code below:</p>
                            
                            <div class="verification-code">
                                ${verificationToken}
                            </div>
                            
                            <p>Please enter this code on the verification page to activate your account.</p>
                            
                            <p class="expiry-notice">This code will expire in <strong>10 minutes</strong>.</p>
                            
                            <p>If you did not request this verification code, please ignore this email.</p>
                        </div>
                        <div class="footer">
                            <p>&copy; 2025 Aceone. All rights reserved.</p>
                            <p>This is an automated message, please do not reply to this email.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        await transporter.sendMail(mailOptions);

        return sendResponse(res, 200, true, "New verification code sent to your email.");
    } catch (err) {
        dbgr("Resend OTP Error:", err.message);
        return sendResponse(res, 500, false, "Something went wrong while resending verification code.");
    }
}

async function loginUser(req, res) {
    try {
        const { email, password } = req.body;
        const user = await UserModel.findOne({ email });

        if (!user) {
            return sendResponse(res, 400, false, "User not found with this email.");
        }

        if (!user.isVerified) {
            return sendResponse(res, 403, false, "Email not verified. Please verify your email first.");
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return sendResponse(res, 400, false, "Invalid password.");
        }

        const token = jwt.sign(
            { email: user.email, ID: user._id, role: "user" },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: true,
            sameSite: "None",
            maxAge: 24 * 60 * 60 * 1000
        });

        const userResponse = await UserModel.findById(user._id).select('-password -verificationToken -verificationTokenExpires');

        return sendResponse(res, 200, true, "User logged in successfully.", userResponse);
    } catch (err) {
        dbgr("Login User Error:", err.message);
        return sendResponse(res, 500, false, "Something went wrong.");
    }
}

function logoutUser(req, res) {
    try {
        res.clearCookie('token', {
            httpOnly: true,
            secure: true,
            sameSite: "None",
        });

        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        return sendResponse(res, 200, true, "User logged out successfully.");
    } catch (err) {
        dbgr("Logout User Error:", err.message);
        return sendResponse(res, 500, false, "Something went wrong.");
    }
}

async function forgotPassword(req, res) {
    try {
        const { email } = req.body;
        const user = await UserModel.findOne({ email });

        if (!user) {
            return sendResponse(res, 400, false, "User not found with this email.");
        }

        if (!user.isVerified) {
            return sendResponse(res, 403, false, "Email not verified. Please verify your email first.");
        }

        // Generate reset token (OTP)
        const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
        const resetTokenExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        user.verificationToken = resetToken;
        user.verificationTokenExpires = resetTokenExpires;
        await user.save();

        const mailOptions = {
            from: process.env.MAIL,
            to: email,
            subject: 'Password Reset for Your Account',
            html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Email Verification</title>
                <style>
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        line-height: 1.6;
                        color: #333333;
                        margin: 0;
                        padding: 0;
                    }
                    .container {
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                    }
                    .header {
                        background-color: #4A90E2;
                        padding: 20px;
                        text-align: center;
                        color: white;
                        border-radius: 5px 5px 0 0;
                    }
                    .content {
                        background-color: #ffffff;
                        padding: 30px;
                        border-left: 1px solid #e6e6e6;
                        border-right: 1px solid #e6e6e6;
                    }
                    .verification-code {
                        font-size: 32px;
                        font-weight: bold;
                        text-align: center;
                        letter-spacing: 5px;
                        margin: 20px 0;
                        padding: 15px;
                        background-color: #f7f7f7;
                        border-radius: 5px;
                        color: #333333;
                    }
                    .expiry-notice {
                        text-align: center;
                        color: #777777;
                        font-size: 14px;
                        margin-top: 20px;
                    }
                    .footer {
                        background-color: #f7f7f7;
                        padding: 15px;
                        text-align: center;
                        font-size: 12px;
                        color: #777777;
                        border-radius: 0 0 5px 5px;
                        border: 1px solid #e6e6e6;
                    }
                    .button {
                        display: inline-block;
                        background-color: #4A90E2;
                        color: white;
                        text-decoration: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        margin-top: 15px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Email Verification</h1>
                    </div>
                    <div class="content">
                        <p>Hello,</p>
                        <p>Thank you for registering with our e-commerce platform. To change your password, please use the verification code below:</p>
                        
                        <div class="verification-code">
                            ${resetToken}
                        </div>
                        
                        <p>Please enter this code on the verification page to change your password.</p>
                        
                        <p class="expiry-notice">This code will expire in <strong>10 minutes</strong>.</p>
                        
                        <p>If you did not request this verification code, please ignore this email.</p>
                    </div>
                    <div class="footer">
                        <p>&copy; 2025 Aceone. All rights reserved.</p>
                        <p>This is an automated message, please do not reply to this email.</p>
                    </div>
                </div>
            </body>
            </html>
        `
        };

        await transporter.sendMail(mailOptions);

        return sendResponse(res, 200, true, "Password reset code sent to your email.");
    }
    catch (err) {
        dbgr("Forgot Password Error:", err.message);
        return sendResponse(res, 500, false, "Something went wrong.");
    }
}

async function verifyResetToken(req, res) {
    try {
        const { Email_Otp } = req.body;

        const FinalEmail = Email_Otp.email;
        const otp = Email_Otp.otp;

        const user = await UserModel.findOne({
            email: FinalEmail,
            verificationToken: otp,
            verificationTokenExpires: { $gt: Date.now() }
        });

        if (!user) {
            return sendResponse(res, 400, false, "Invalid or expired reset code.");
        }

        // Generate temporary token for password reset
        const token = jwt.sign(
            { email: user.email, ID: user._id, purpose: "passwordReset" },
            process.env.JWT_SECRET,
            { expiresIn: '10m' }
        );

        res.cookie('resetToken', token, {
            httpOnly: true,
            secure: true,
            sameSite: "None",
            maxAge: 10 * 60 * 1000 // 10 minutes
        });

        return sendResponse(res, 200, true, "Reset code verified. You can now reset your password.");
    } catch (err) {
        dbgr("Verify Reset Token Error:", err.message);
        return sendResponse(res, 500, false, "Something went wrong during verification.");
    }
}

async function resetPassword(req, res) {
    try {
        const token = req.cookies.resetToken;
        const { newPass } = req.body;

        const newPassword = newPass.password;

        // Add validation for newPassword
        if (!newPassword) {
            return sendResponse(res, 400, false, "New password is required.");
        }

        if (!token) {
            return sendResponse(res, 401, false, "Unauthorized. Please verify your reset code first.");
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.purpose !== "passwordReset") {
            return sendResponse(res, 401, false, "Invalid token purpose.");
        }

        const user = await UserModel.findById(decoded.ID);

        if (!user) {
            return sendResponse(res, 400, false, "User not found.");
        }

        // Clear verification token
        user.verificationToken = undefined;
        user.verificationTokenExpires = undefined;

        // Update password
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedNewPassword;

        await user.save();

        // Clear the reset token cookie
        res.clearCookie('resetToken');

        return sendResponse(res, 200, true, "Password reset successfully. Please login with your new password.");
    } catch (err) {
        dbgr("Reset Password Error:", err.message);
        return sendResponse(res, 500, false, "Something went wrong.");
    }
}

async function getUserProfile(req, res) {
    try {
        const user = await UserModel.findById(req.user.ID);

        if (!user) {
            return sendResponse(res, 400, false, "User not found.");
        }

        if (user && !user.isVerified) {
            return sendResponse(res, 400, false, "User found, but not verified");
        }

        let base64Image = null;
        if (user.picture && user.picture.data) {
            base64Image = `data:${user.picture.contentType};base64,${user.picture.data.toString("base64")}`;
        }

        return sendResponse(res, 200, true, "User profile fetched successfully.", {
            ...user.toObject(),
            picture: base64Image, // Will be null if no valid picture data
        });
    } catch (err) {
        dbgr("Get User Profile Error:", err.message);
        return sendResponse(res, 500, false, "Something went wrong.");
    }
}


async function updateUserProfile(req, res) {
    try {
        const { fullName, contact, dateOfBirth, address } = req.body;

        // Validate user ID
        if (!req.user.ID) {
            return sendResponse(res, 400, false, "Invalid user ID.");
        }

        let user = await UserModel.findById(req.user.ID);

        if (!user) {
            return sendResponse(res, 404, false, "User not found.");
        }

        // Update fields if provided
        user.fullName = fullName || user.fullName;
        user.contact = contact || user.contact;
        user.dateOfBirth = new Date(dateOfBirth) || user.dateOfBirth;
        user.address = address !== undefined ? address : user.address;

        await user.save();
        // Regenerate token **only if email changes**
        if (req.body.email && req.body.email !== user.email) {
            return sendResponse(res, 400, false, "Email updates are not allowed directly.");
        }

        let base64Image = null;
        if (user.picture && user.picture.data) {
            base64Image = `data:${user.picture.contentType};base64,${user.picture.data.toString("base64")}`;
        }

        return sendResponse(res, 200, true, "User profile fetched successfully.", {
            ...user.toObject(),
            picture: base64Image,
        });
    } catch (err) {
        console.error("Update User Profile Error:", err.message);
        return sendResponse(res, 500, false, "Something went wrong.");
    }
}


async function updateProfilePicture(req, res) {
    try {
        const user = await UserModel.findById(req.user.ID);

        if (!user) {
            return sendResponse(res, 400, false, "User not found.");
        }

        user.picture.data = req.file.buffer;
        user.picture.contentType = req.file.mimetype;

        await user.save();

        const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
        return sendResponse(res, 200, true, "Profile picture updated successfully.", base64Image);
    } catch (err) {
        dbgr("Update Profile Picture Error:", err.message);
        return sendResponse(res, 500, false, "Something went wrong.");
    }
}

async function getUserCart(req, res) {
    try {
        const userId = req.user?.ID || null;
        const sessionId = req.cookies.sessionId;

        mergeCartsAfterLogin(userId, sessionId);

        if (!userId && !sessionId) {
            return sendResponse(res, 200, true, "Cart is empty.", []);
        }

        const query = userId ? { userId } : { sessionId };
        const cart = await CartModel.findOne(query).populate('items.productId');

        if (!cart || cart.items.length === 0) {
            return sendResponse(res, 200, true, "Cart is empty.", []);
        }

        // Filter out invalid items (e.g., deleted products)
        const validItems = cart.items.filter(item => item.productId);

        // If there were invalid items, update the cart silently
        if (validItems.length !== cart.items.length) {
            cart.items = validItems;
            await cart.save();

            // Sync with UserModel if logged in
            if (userId) {
                await UserModel.findByIdAndUpdate(
                    userId,
                    { $set: { cart: cart._id } },
                    { new: true }
                );
            }
        }

        const formattedItems = validItems.map(item => ({
            ...item.toObject(),
            productId: item.productId ? {
                ...item.productId.toObject(),
                image: item.productId.image?.data
                    ? `data:${item.productId.image.contentType};base64,${item.productId.image.data.toString("base64")}`
                    : null
            } : null
        }));

        return sendResponse(res, 200, true, "User cart fetched successfully.", formattedItems);
    } catch (err) {
        console.error("Get User Cart Error:", err);
        return sendResponse(res, 500, false, "Something went wrong.", err.message);
    }
}

async function addToCart(req, res) {
    try {
        const { productID, quantity = 1 } = req.body;

        if (!productID) {
            return sendResponse(res, 400, false, "Product ID is required.");
        }

        const product = await ProductModel.findById(productID);
        if (!product) {
            return sendResponse(res, 404, false, "Product not found.");
        }

        // Get identification info
        let userId = req.user?.ID || null;
        let sessionId = req.cookies.sessionId;

        // Ensure we have a sessionId for non-logged in users
        if (!userId && !sessionId) {
            sessionId = Math.random().toString(36).substring(2);
            res.cookie("sessionId", sessionId, {
                httpOnly: true,
                secure: true, // Must be true when sameSite is None
                sameSite: "None",
                maxAge: 24 * 60 * 60 * 1000
            });
        }

        // Ensure quantity is a positive integer
        const validQuantity = Math.max(1, parseInt(quantity, 10) || 1);

        // Prevent adding more than available stock
        if (validQuantity > product.stock) {
            return sendResponse(res, 400, false, `Only ${product.stock} units available.`);
        }

        // Find cart associated with either userId or sessionId
        const query = userId ? { userId } : { sessionId };
        let cart = await CartModel.findOne(query);

        if (!cart) {
            // Create new cart with appropriate identifier
            cart = new CartModel({
                ...(userId ? { userId } : { sessionId }),
                items: []
            });
        }

        const existingItemIndex = cart.items.findIndex(
            (item) => item.productId && item.productId.toString() === productID
        );

        if (existingItemIndex !== -1) {
            // Update existing item
            const newQuantity = cart.items[existingItemIndex].quantity + validQuantity;

            if (newQuantity > product.stock) {
                return sendResponse(res, 400, false, `Cannot add more than ${product.stock} units.`);
            }

            cart.items[existingItemIndex].quantity = newQuantity;
        } else {
            // Add new item
            cart.items.push({ productId: productID, quantity: validQuantity });
        }

        await cart.save();

        // Update UserModel if logged in
        if (userId) {
            await UserModel.findByIdAndUpdate(
                userId,
                { $set: { cart: cart._id } },
                { new: true }
            );
        }

        // Return the cart with populated product details
        const populatedCart = await CartModel.findById(cart._id).populate('items.productId');
        const formattedItems = populatedCart.items.map(item => ({
            ...item.toObject(),
            productId: item.productId ? {
                ...item.productId.toObject(),
                image: item.productId.image?.data
                    ? `data:${item.productId.image.contentType};base64,${item.productId.image.data.toString("base64")}`
                    : null
            } : null
        }));

        return sendResponse(res, 200, true, "Product added to cart.", formattedItems);
    } catch (err) {
        console.error("Add To Cart Error:", err);
        return sendResponse(res, 500, false, "Something went wrong.", err.message);
    }
}


async function updateCartQuantity(req, res) {
    try {
        const { productID, change } = req.body;
        const userId = req.user?.ID || null;
        const sessionId = req.cookies.sessionId;

        if (!userId && !sessionId) {
            return sendResponse(res, 400, false, "No user or session found.");
        }

        if (!productID) {
            return sendResponse(res, 400, false, "Product ID is required.");
        }

        const changeValue = Number(change);
        if (isNaN(changeValue)) {
            return sendResponse(res, 400, false, "Invalid quantity change value.");
        }

        // Find cart with proper query
        const query = userId ? { userId } : { sessionId };
        const cart = await CartModel.findOne(query);

        if (!cart) {
            return sendResponse(res, 404, false, "Cart not found.");
        }

        // Find the item in the cart
        const itemIndex = cart.items.findIndex(item =>
            String(item.productId) === String(productID) ||
            String(item.productId?._id) === String(productID)
        );

        if (itemIndex === -1) {
            return sendResponse(res, 404, false, "Product not found in cart.");
        }

        // Calculate new quantity
        const updatedQuantity = cart.items[itemIndex].quantity + changeValue;

        // Check product stock if increasing quantity
        if (changeValue > 0) {
            const product = await ProductModel.findById(productID);
            if (!product) {
                return sendResponse(res, 404, false, "Product not found.");
            }

            if (updatedQuantity > product.stock) {
                return sendResponse(res, 400, false, `Cannot add more than ${product.stock} units.`);
            }
        }

        // Remove item or update quantity
        if (updatedQuantity <= 0) {
            cart.items.splice(itemIndex, 1);
        } else {
            cart.items[itemIndex].quantity = updatedQuantity;
        }

        await cart.save();

        // Update UserModel if logged in
        if (userId) {
            await UserModel.findByIdAndUpdate(
                userId,
                { $set: { cart: cart._id } },
                { new: true }
            );
        }

        // Return updated cart with populated products
        const populatedCart = await CartModel.findById(cart._id).populate('items.productId');
        const formattedItems = populatedCart.items.map(item => ({
            ...item.toObject(),
            productId: item.productId ? {
                ...item.productId.toObject(),
                image: item.productId.image?.data
                    ? `data:${item.productId.image.contentType};base64,${item.productId.image.data.toString("base64")}`
                    : null
            } : null
        }));

        return sendResponse(res, 200, true, "Cart updated successfully.", formattedItems);
    } catch (err) {
        console.error("Update Cart Quantity Error:", err.message);
        return sendResponse(res, 500, false, "Something went wrong.", err.message);
    }
}

async function removeFromCart(req, res) {
    try {
        const { productID } = req.body;
        const userId = req.user?.ID || null;
        const sessionId = req.cookies.sessionId;

        if (!productID) {
            return sendResponse(res, 400, false, "Product ID is required.");
        }

        if (!userId && !sessionId) {
            return sendResponse(res, 400, false, "No user or session found.");
        }

        // Find cart with proper query
        const query = userId ? { userId } : { sessionId };
        const cart = await CartModel.findOne(query);

        if (!cart || !cart.items.length) {
            return sendResponse(res, 404, false, "Cart is empty.");
        }

        const initialLength = cart.items.length;
        cart.items = cart.items.filter(item =>
            item.productId && item.productId.toString() !== productID
        );

        if (cart.items.length === initialLength) {
            return sendResponse(res, 404, false, "Product not found in cart.");
        }

        await cart.save();

        // Update UserModel if logged in
        if (userId) {
            await UserModel.findByIdAndUpdate(
                userId,
                { $set: { cart: cart._id } },
                { new: true }
            );
        }

        // Return updated cart with populated products
        const populatedCart = await CartModel.findById(cart._id).populate('items.productId');
        const formattedItems = populatedCart.items.map(item => ({
            ...item.toObject(),
            productId: item.productId ? {
                ...item.productId.toObject(),
                image: item.productId.image?.data
                    ? `data:${item.productId.image.contentType};base64,${item.productId.image.data.toString("base64")}`
                    : null
            } : null
        }));

        return sendResponse(res, 200, true, "Product removed from cart successfully.", formattedItems);
    } catch (err) {
        console.error("Remove From Cart Error:", err.message);
        return sendResponse(res, 500, false, "Something went wrong.", err.message);
    }
}

async function mergeCartsAfterLogin(userId, sessionId) {
    try {
        if (!sessionId || !userId) return;

        const guestCart = await CartModel.findOne({ sessionId }).populate('items.productId');
        if (!guestCart || guestCart.items.length === 0) return;

        let userCart = await CartModel.findOne({ userId }).populate('items.productId');

        if (!userCart) {
            // If user has no cart, assign the guest cart to the user
            guestCart.userId = userId;
            guestCart.sessionId = undefined;
            await guestCart.save();

            // Update UserModel reference
            await UserModel.findByIdAndUpdate(
                userId,
                { $set: { cart: guestCart._id } },
                { new: true }
            );
            return;
        }

        // Merge the items from guest cart to user cart
        let hasChanges = false;

        for (const guestItem of guestCart.items) {
            if (!guestItem.productId) continue; // Skip invalid items

            const product = await ProductModel.findById(guestItem.productId._id);
            if (!product) continue; // Skip if product no longer exists

            const existingItemIndex = userCart.items.findIndex(
                item => item.productId &&
                    item.productId._id.toString() === guestItem.productId._id.toString()
            );

            if (existingItemIndex !== -1) {
                // Update quantity without exceeding stock
                const newQuantity = Math.min(
                    userCart.items[existingItemIndex].quantity + guestItem.quantity,
                    product.stock
                );
                userCart.items[existingItemIndex].quantity = newQuantity;
                hasChanges = true;
            } else {
                // Add new item
                userCart.items.push({
                    productId: guestItem.productId._id,
                    quantity: Math.min(guestItem.quantity, product.stock)
                });
                hasChanges = true;
            }
        }

        if (hasChanges) {
            await userCart.save();

            // Update UserModel reference
            await UserModel.findByIdAndUpdate(
                userId,
                { $set: { cart: userCart._id } },
                { new: true }
            );
        }

        // Remove the guest cart
        await CartModel.deleteOne({ _id: guestCart._id });
    } catch (err) {
        console.error("Merge Carts Error:", err);
    }
}

async function clearCart(req, res) {
    try {
        const userId = req.user?.ID || null;
        const sessionId = req.cookies.sessionId;

        if (!userId && !sessionId) {
            return sendResponse(res, 400, false, "No user or session found.");
        }

        // Find cart with proper query
        const query = userId ? { userId } : { sessionId };
        const cart = await CartModel.findOne(query);

        if (!cart) {
            return sendResponse(res, 200, true, "Cart is already empty.");
        }

        cart.items = [];
        await cart.save();

        // Update UserModel if logged in
        if (userId) {
            await UserModel.findByIdAndUpdate(
                userId,
                { $set: { cart: cart._id } },
                { new: true }
            );
        }

        return sendResponse(res, 200, true, "Cart cleared successfully.", []);
    } catch (err) {
        console.error("Clear Cart Error:", err.message);
        return sendResponse(res, 500, false, "Something went wrong.", err.message);
    }
}

async function getUserOrders(req, res) {
    try {
        const orders = await OrderModel.find({ customer: req.user.ID })
            .populate('items.product')
            .populate('payment', 'status paymentId orderId method');

        // Format product images in Base64
        const formattedOrders = orders.map(order => ({
            ...order.toObject(),
            items: order.items.map(item => ({
                ...item.toObject(),
                product: {
                    ...item.product.toObject(),
                    image: item.product.image?.data
                        ? `data:${item.product.image.contentType};base64,${item.product.image.data.toString("base64")}`
                        : null
                }
            }))
        }));

        return sendResponse(res, 200, true, "User orders fetched successfully.", formattedOrders);
    } catch (err) {
        dbgr("Get User Orders Error:", err.message);
        return sendResponse(res, 500, false, err.message + "Something went wrong.");
    }
}

async function placeOrder(req, res) {
    try {
        if (!req.user || !req.user.ID) {
            return sendResponse(res, 401, false, "Please login to place an order.");
        }

        const { modeOfPayment, deliveryFee } = req.body;

        if (!["Online", "Cash on Delivery"].includes(modeOfPayment)) {
            return sendResponse(res, 400, false, "Invalid payment mode. Choose 'Online' or 'Cash on Delivery'.");
        }

        if (typeof deliveryFee !== "number" || deliveryFee < 0) {
            return sendResponse(res, 400, false, "Invalid delivery fee.");
        }

        const cart = await CartModel.findOne({ userId: req.user.ID }).populate('items.productId');

        if (!cart || cart.items.length === 0) {
            return sendResponse(res, 400, false, "Cart is empty. Cannot place order.");
        }

        let totalAmount = 0;
        const orderItems = [];

        for (let item of cart.items) {
            const product = item.productId;
            if (!product) {
                return sendResponse(res, 400, false, "One or more products in your cart are no longer available.");
            }

            if (product.stock < item.quantity) {
                return sendResponse(res, 400, false, `Product ${product.name} is out of stock.`);
            }

            totalAmount += (product.discount === 0 ? product.price : product.discountPrice) * item.quantity;

            orderItems.push({
                product: product._id,
                quantity: item.quantity,
                price: product.discount === 0 ? product.price : product.discountPrice
            });
        }

        totalAmount += deliveryFee;

        // Create a new order with initial status
        const newOrder = new OrderModel({
            customer: req.user.ID,
            items: orderItems,
            totalAmount,
            owner: orderItems[0].product.owner,
            orderDate: new Date(),
            modeOfPayment,
            orderStatus: modeOfPayment === "Cash on Delivery" ? "Pending" : "Awaiting Payment",
            deliveryFee
        });

        await newOrder.save();

        // Create payment record if online payment
        let paymentResponse = null;

        if (modeOfPayment === "Online") {
            // Create Razorpay order
            const razorpayOrderData = {
                amount: totalAmount,
                currency: 'INR',
                orderId: newOrder._id.toString(),
                customerId: req.user.ID,
                description: `Payment for order #${newOrder._id}`
            };

            const razorpayOrder = await createRazorpayOrder(razorpayOrderData);

            // Create payment record in DB
            const paymentRecord = new PaymentModel({
                order: newOrder._id,
                customer: req.user.ID,
                amount: totalAmount,
                currency: 'INR',
                razorpayOrderId: razorpayOrder.orderId,
                status: 'created'
            });

            await paymentRecord.save();

            // Associate payment with order
            newOrder.payment = paymentRecord._id;
            await newOrder.save();

            // Add razorpay order details to response
            paymentResponse = {
                razorpayOrderId: razorpayOrder.orderId,
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency,
                status: razorpayOrder.status
            };
        } else {
            // For Cash on Delivery, update product stock immediately
            for (let item of cart.items) {
                const product = await ProductModel.findById(item.productId);
                if (product) {
                    product.stock -= item.quantity;
                    // Update product's customers array with the user ID
                    if (!product.customer.includes(req.user.ID)) {
                        product.customer.push(req.user.ID);
                    }
                    await product.save();
                }
            }

            // Generate invoice for COD orders
            await generateInvoice(newOrder._id);
        }

        // Update the UserModel to include this order
        await UserModel.findByIdAndUpdate(req.user.ID, {
            $push: { orders: newOrder._id }, // Append order to user's orders array
            $set: { cart: null } // Remove cart reference after order is placed
        });

        // Remove the cart after order is placed
        await CartModel.findOneAndDelete({ userId: req.user.ID });

        const responseData = {
            order: newOrder,
            payment: paymentResponse
        };

        return sendResponse(res, 200, true, "Order placed successfully.", responseData);
    } catch (err) {
        dbgr("Place Order Error:", err.message);
        return sendResponse(res, 500, false, err.message + "Something went wrong.");
    }
}

async function verifyPayment(req, res) {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            orderId
        } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderId) {
            return sendResponse(res, 400, false, "Missing payment verification parameters.");
        }

        // Verify and capture payment
        const paymentData = {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        };

        const capturedPayment = await capturePayment(paymentData);

        // Update payment record
        const payment = await PaymentModel.findOneAndUpdate(
            { razorpayOrderId: razorpay_order_id },
            {
                paymentId: razorpay_payment_id,
                status: capturedPayment.status,
                method: capturedPayment.method,
                updatedAt: new Date()
            },
            { new: true }
        );

        if (!payment) {
            return sendResponse(res, 404, false, "Payment record not found.");
        }

        // Update order status
        const order = await OrderModel.findById(orderId);

        if (!order) {
            return sendResponse(res, 404, false, "Order not found.");
        }

        // Update product stock only after successful payment
        for (let item of order.items) {
            const product = await ProductModel.findById(item.product);
            if (product) {
                product.stock -= item.quantity;
                // Update product's customers array with the user ID
                if (!product.customer.includes(order.customer)) {
                    product.customer.push(order.customer);
                }
                await product.save();
            }
        }

        // Update order status based on payment status
        if (capturedPayment.status === 'captured') {
            order.orderStatus = 'Confirmed';

            // Generate invoice after successful payment
            await generateInvoice(order._id);
        } else {
            order.orderStatus = 'Payment Failed';
        }

        await order.save();

        return sendResponse(res, 200, true, "Payment verified successfully.", {
            order,
            payment: capturedPayment
        });
    } catch (err) {
        dbgr("Payment Verification Error:", err.message);
        return sendResponse(res, 500, false, err.message + "Payment verification failed.");
    }
}

async function cancelOrder(req, res) {
    try {
        const { orderID } = req.body;
        const user = await UserModel.findById(req.user.ID);

        if (!user) {
            return sendResponse(res, 400, false, "User not found.");
        }

        const order = await OrderModel.findById(orderID).populate('payment');

        if (!order) {
            return sendResponse(res, 400, false, "Order not found.");
        }

        if (order.customer.toString() !== user._id.toString()) {
            return sendResponse(res, 403, false, "Unauthorized access.");
        }

        if (order.orderStatus === "Cancelled") {
            return sendResponse(res, 400, false, "Order is already cancelled.");
        }

        // Check if order can be cancelled
        const nonCancellableStatuses = ["Delivered", "Shipped"];
        if (nonCancellableStatuses.includes(order.orderStatus)) {
            return sendResponse(res, 400, false, `Cannot cancel order in ${order.orderStatus} status.`);
        }

        // Process refund for online payments
        let refundResult = null;
        if (order.modeOfPayment === "Online" && order.payment &&
            order.payment.status === "captured" && order.payment.paymentId) {

            const refundData = {
                paymentId: order.payment.paymentId,
                amount: order.totalAmount,
                reason: "Order cancelled by customer",
                metadata: {
                    orderId: order._id.toString(),
                    customerId: user._id.toString()
                }
            };

            refundResult = await processRefund(refundData);

            // Update payment record with refund info
            await PaymentModel.findByIdAndUpdate(order.payment._id, {
                refundId: refundResult.refundId,
                refundStatus: refundResult.status,
                refundedAt: new Date()
            });
        }

        // Return stock to products
        for (let item of order.items) {
            const product = await ProductModel.findById(item.product);
            if (product) {
                product.stock += item.quantity;
                await product.save();
            }
        }

        order.orderStatus = "Cancelled";
        order.cancelledAt = new Date();
        order.cancellationReason = req.body.reason || "Cancelled by customer";
        await order.save();

        const responseData = {
            order,
            refund: refundResult
        };

        return sendResponse(res, 200, true, "Order cancelled successfully.", responseData);
    } catch (err) {
        dbgr("Cancel Order Error:", err.message);
        return sendResponse(res, 500, false, err.message + "Something went wrong.");
    }
}

async function getWishlist(req, res) {
    try {
        const user = await UserModel.findById(req.user.ID).populate('wishlist');

        if (!user) {
            return sendResponse(res, 400, false, "User not found.");
        }

        const wishlist = await wishModel.find({ customer: user._id }).populate("product");

        // Format product images in Base64
        const formattedWishlist = wishlist.map(item => ({
            ...item.toObject(),
            product: {
                ...item.product.toObject(),
                image: item.product.image?.data
                    ? `data:${item.product.image.contentType};base64,${item.product.image.data.toString("base64")}`
                    : null
            }
        }));

        return sendResponse(res, 200, true, "User wishlist fetched successfully.", formattedWishlist);
    } catch (err) {
        dbgr("Get Wishlist Error:", err.message);
        return sendResponse(res, 500, false, "Something went wrong.");
    }
}

async function addToWishlist(req, res) {
    try {
        const { productID } = req.body;
        const user = await UserModel.findById(req.user.ID);

        if (!user) {
            return sendResponse(res, 400, false, "User not found.");
        }

        const product = await ProductModel.findById(productID);
        if (!product) {
            return sendResponse(res, 400, false, "Product not found.");
        }

        const existingWish = await wishModel.findOne({ product: productID, customer: user._id });
        if (existingWish) {
            return sendResponse(res, 400, false, "Product already in wishlist.");
        }

        const newWish = new wishModel({
            product: productID,
            customer: user._id,
            owner: product.owner
        });
        await newWish.save();

        user.wishlist.push(newWish._id);
        await user.save();

        return sendResponse(res, 200, true, "Product added to wishlist successfully.", newWish);
    } catch (err) {
        dbgr("Add To Wishlist Error:", err.message);
        return sendResponse(res, 500, false, "Something went wrong.");
    }
}


async function removeFromWishlist(req, res) {
    try {
        const { productID } = req.body; // Now correctly receives productID
        const user = await UserModel.findById(req.user.ID);

        if (!user) {
            return sendResponse(res, 400, false, "User not found.");
        }

        const wish = await wishModel.findOne({ product: productID, customer: user._id });
        if (!wish) {
            return sendResponse(res, 400, false, "Product not found in wishlist.");
        }

        await wishModel.findByIdAndDelete(wish._id);
        user.wishlist = user.wishlist.filter(wishId => wishId.toString() !== wish._id.toString());
        await user.save();

        return sendResponse(res, 200, true, "Product removed from wishlist successfully.");
    } catch (err) {
        dbgr("Remove From Wishlist Error:", err.message);
        return sendResponse(res, 500, false, "Something went wrong.");
    }
}

async function searchUsers(req, res) {
    try {
        const query = req.query.q?.trim();

        if (!query) {
            return sendResponse(res, 400, false, "Query parameter is required");
        }

        const users = await UserModel.find({
            fullName: { $regex: new RegExp(query, "i") }
        });

        // Format user profile pictures in Base64
        const formattedUsers = users.map(user => {
            let formattedUser = user.toObject();

            if (user.picture && user.picture.data) {
                formattedUser.picture = `data:${user.picture.contentType};base64,${user.picture.data.toString("base64")}`;
            } else {
                formattedUser.picture = null;
            }

            return formattedUser;
        });

        sendResponse(res, 200, true, "User search results retrieved", formattedUsers);
    } catch (error) {
        sendResponse(res, 500, false, error.message);
    }
}

module.exports = {
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
    clearCart
};
