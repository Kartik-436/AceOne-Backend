const ProductModel = require('../models/product.js');
const UserModel = require('../models/user.js');
const OrderModel = require('../models/order.js');
const wishModel = require('../models/wishlist.js');
const CartModel = require('../models/cart.js')
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const sendResponse = require('../utils/Send-Response.js');
require('dotenv').config();


const dbgr = require('debug')('development:userController');


const loginLimiter = rateLimit({
    windowMs: 12 * 60 * 1000,
    max: 6,
    message: "Too many login attempts, please try again later."
});


async function registerUser(req, res) {
    try {
        const { fullName, email, password, contact, dateOfBirth } = req.body;
        const user = await UserModel.findOne({ email });

        if (user !== undefined && user !== null) {
            return sendResponse(res, 400, false, "User already exists with this email.");
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new UserModel({
            fullName,
            email,
            password: hashedPassword,
            contact,
            dateOfBirth: new Date(dateOfBirth),
        });

        await newUser.save();

        const token = jwt.sign(
            { email: newUser.email, ID: newUser._id, role: "user" },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000
        });

        const userResponse = await UserModel.findById(newUser._id)

        return sendResponse(res, 201, true, "User registered successfully.", userResponse);
    } catch (err) {
        dbgr("Register User Error:", err.message);
        return sendResponse(res, 500, false, "Something went wrong.");
    }
}


async function loginUser(req, res) {
    try {
        const { email, password } = req.body;
        const user = await UserModel.findOne({ email });

        if (!user) {
            return sendResponse(res, 400, false, "User not found with this email.");
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
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000
        });

        const userResponse = await UserModel.findById(user._id).select('-password');

        return sendResponse(res, 200, true, "User logged in successfully.", userResponse);
    } catch (err) {
        dbgr("Login User Error:", err.message);
        return sendResponse(res, 500, false, "Something went wrong.");
    }
}


function logoutUser(req, res) {
    try {
        res.clearCookie('token');
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

        const token = jwt.sign(
            { email: user.email, ID: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '10m' }
        );


        dbgr("Password Reset Token:", token);

        return sendResponse(res, 200, true, "Password reset token sent to your email.");
    }
    catch (err) {
        dbgr("Forgot Password Error:", err.message);
        return sendResponse(res, 500, false, "Something went wrong.");
    }
}


async function resetPassword(req, res) {
    try {
        const token = req.cookies.token;
        const { oldPassword, newPassword } = req.body;

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await UserModel.findById(decoded.ID);

        if (!user) {
            return sendResponse(res, 400, false, "User not found.");
        }

        const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);

        if (!isOldPasswordValid) {
            return sendResponse(res, 400, false, "Invalid old password.");
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedNewPassword;

        await user.save();

        return sendResponse(res, 200, true, "Password reset successfully.");
    } catch (err) {
        dbgr("Reset Password Error:", err.message);
        return sendResponse(res, 500, false, "Something went wrong.");
    }
}


async function getUserProfile(req, res) {
    try {
        const user = await UserModel.findById(req.user.ID).select('-password');

        if (!user) {
            return sendResponse(res, 400, false, "User not found.");
        }
        const base64Image = `data:${user.picture.contentType};base64,${user.picture.data.toString("base64")}`;
        return sendResponse(res, 200, true, "User profile fetched successfully.", {
            ...user.toObject(), // Include other user data
            picture: base64Image, // Send Base64 image
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

        return sendResponse(res, 200, true, "User profile updated successfully.", user);
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
        let userId = req.user ? req.user.ID : null;
        let sessionId = req.cookies.sessionId;

        if (!userId && !sessionId) {
            sessionId = Math.random().toString(36).substring(2);
            res.cookie("sessionId", sessionId, { httpOnly: true });
            cart = new CartModel({ userId, sessionId, items: [] });
            return sendResponse(res, 200, true, "Cart is empty.", []);
        }

        const cart = await CartModel.findOne({
            $or: [
                userId ? { userId } : null,
                sessionId ? { sessionId } : null
            ].filter(Boolean)
        }).populate('items.productId');

        if (!cart) {
            return sendResponse(res, 200, true, "Cart is empty.", []);
        }

        return sendResponse(res, 200, true, "User cart fetched successfully.", cart.items);
    } catch (err) {
        dbgr("Get User Cart Error:", err.message);
        return sendResponse(res, 500, false, "Something went wrong.");
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
            return sendResponse(res, 400, false, "Product not found.");
        }

        let userId = req.user ? req.user.ID : null;
        let sessionId = req.cookies.sessionId;

        if (!userId && !sessionId) {
            sessionId = Math.random().toString(36).substring(2);
            res.cookie("sessionId", sessionId, { httpOnly: true });
        }

        let cart = await CartModel.findOne({
            $or: [
                userId ? { userId } : null,
                sessionId ? { sessionId } : null
            ].filter(Boolean)
        });

        if (!cart) {
            cart = new CartModel({ userId, sessionId, items: [] });
        }

        const existingItem = cart.items.find((item) => item.productId.toString() === productID);
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            cart.items.push({ productId: productID, quantity });
        }

        await cart.save();
        return sendResponse(res, 200, true, "Product added to cart.", cart.items);
    } catch (err) {
        dbgr("Add To Cart Error:", err.message);
        return sendResponse(res, 500, false, "Something went wrong.");
    }
}


async function updateCartQuantity(req, res) {
    try {
        const { productID, change } = req.body;
        let sessionId = req.cookies.sessionId;

        if (!sessionId) {
            return sendResponse(res, 400, false, "No session found.");
        }


        const changeValue = Number(change);
        if (isNaN(changeValue)) {
            return sendResponse(res, 400, false, "Invalid quantity change value.");
        }

        let cart = await CartModel.findOne({ sessionId });
        if (!cart) return sendResponse(res, 404, false, "Cart not found.");

        dbgr("Cart items before update:", JSON.stringify(cart.items, null, 2));
        dbgr("Received productID:", productID, "Change Value:", changeValue);

        const itemIndex = cart.items.findIndex(item =>
            String(item.productId) === String(productID) ||
            String(item.productId?._id) === String(productID)
        );

        if (itemIndex === -1) {
            return sendResponse(res, 404, false, "Product not found in cart.");
        }

        const updatedQuantity = cart.items[itemIndex].quantity + changeValue;
        if (updatedQuantity <= 0) {
            cart.items.splice(itemIndex, 1);
        } else {
            cart.items[itemIndex].quantity = updatedQuantity;
        }

        await cart.save();
        dbgr("Cart items after update:", JSON.stringify(cart.items, null, 2));

        return sendResponse(res, 200, true, "Cart updated successfully.", cart.items);
    } catch (err) {
        dbgr("Update Cart Quantity Error:", err.message);
        return sendResponse(res, 500, false, "Something went wrong.");
    }
}



async function removeFromCart(req, res) {
    try {
        const { productID } = req.body;

        if (!productID) {
            return sendResponse(res, 400, false, "Product ID is required.");
        }

        let userId = req.user ? req.user.ID : null;
        let sessionId = req.cookies.sessionId;

        if (!userId && !sessionId) {
            return sendResponse(res, 400, false, "No user or session found.");
        }

        const cart = await CartModel.findOne({
            $or: [
                userId ? { userId } : null,
                sessionId ? { sessionId } : null
            ].filter(Boolean)
        });

        if (!cart || !cart.items.length) {
            return sendResponse(res, 404, false, "Cart is empty.");
        }

        const initialLength = cart.items.length;
        cart.items = cart.items.filter(item => item.productId.toString() !== productID);

        if (cart.items.length === initialLength) {
            return sendResponse(res, 404, false, "Product not found in cart.");
        }

        await cart.save();

        return sendResponse(res, 200, true, "Product removed from cart successfully.", cart.items);
    } catch (err) {
        dbgr("Remove From Cart Error:", err.message);
        return sendResponse(res, 500, false, "Something went wrong.");
    }
}


async function getUserOrders(req, res) {
    try {
        const orders = await OrderModel.find({ customer: req.user.ID }).populate('items.product');
        return sendResponse(res, 200, true, "User orders fetched successfully.", orders);
    } catch (err) {
        dbgr("Get User Orders Error:", err.message);
        return sendResponse(res, 500, false, "Something went wrong.");
    }
}


async function placeOrder(req, res) {
    try {

        if (!req.user || !req.user.ID) {
            return sendResponse(res, 401, false, "Please login to place an order.");
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
            product.stock -= item.quantity;
            await product.save();

            orderItems.push({
                product: product._id,
                quantity: item.quantity
            });
        }

        const newOrder = new OrderModel({
            customer: req.user.ID,
            items: orderItems,
            totalAmount,
            owner: orderItems[0].productId.owner,
            orderDate: new Date()
        });

        await newOrder.save();


        await CartModel.findOneAndDelete({ userId: req.user.ID });

        return sendResponse(res, 200, true, "Order placed successfully.", newOrder);
    } catch (err) {
        dbgr("Place Order Error:", err.message);
        return sendResponse(res, 500, false, "Something went wrong.");
    }
}


async function cancelOrder(req, res) {
    try {
        const { orderID } = req.body;
        const user = await UserModel.findById(req.user.ID);

        if (!user) {
            return sendResponse(res, 400, false, "User not found.");
        }

        const order = await OrderModel.findById(orderID);

        if (!order) {
            return sendResponse(res, 400, false, "Order not found.");
        }

        if (order.customer.toString() !== user._id.toString()) {
            return sendResponse(res, 403, false, "Unauthorized access.");
        }

        for (let item of order.items) {
            const product = await ProductModel.findById(item.product);
            if (product) {
                product.stock += item.quantity;
                await product.save();
            }
        }

        await OrderModel.findByIdAndDelete(orderID);

        return sendResponse(res, 200, true, "Order cancelled successfully.");
    } catch (err) {
        dbgr("Cancel Order Error:", err.message);
        return sendResponse(res, 500, false, "Something went wrong.");
    }
}


async function getWishlist(req, res) {
    try {
        const user = await UserModel.findById(req.user.ID).populate('wishlist');

        if (!user) {
            return sendResponse(res, 400, false, "User not found.");
        }

        const wishlist = await wishModel.find({ customer: user._id }).populate("product");

        return sendResponse(res, 200, true, "User wishlist fetched successfully.", wishlist);
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
    cancelOrder,
    getWishlist,
    addToWishlist,
    removeFromWishlist,
    updateCartQuantity
};
