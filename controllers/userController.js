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
        const user = await UserModel.findById(req.user.ID);

        if (!user) {
            return sendResponse(res, 400, false, "User not found.");
        }

        // Check if picture exists and has valid data before converting to base64
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
                maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
                sameSite: 'strict'
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
        const orders = await OrderModel.find({ customer: req.user.ID }).populate('items.product');

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
        return sendResponse(res, 500, false, "Something went wrong.");
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
            product.stock -= item.quantity;

            // ✅ Update product's customers array with the user ID
            if (!product.customer.includes(req.user.ID)) {
                product.customer.push(req.user.ID);
            }

            await product.save();

            orderItems.push({
                product: product._id,
                quantity: item.quantity
            });
        }

        totalAmount += deliveryFee;

        const newOrder = new OrderModel({
            customer: req.user.ID,
            items: orderItems,
            totalAmount,
            owner: orderItems[0].product.owner,
            orderDate: new Date(),
            modeOfPayment,
            orderStatus: "Pending"
        });

        await newOrder.save();

        // Update the UserModel to include this order
        await UserModel.findByIdAndUpdate(req.user.ID, {
            $push: { orders: newOrder._id }, // Append order to user's orders array
            $set: { cart: null } // Remove cart reference after order is placed
        });

        // Remove the cart after order is placed
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

        if (order.orderStatus === "Cancelled") {
            return sendResponse(res, 400, false, "Order is already cancelled.");
        }

        for (let item of order.items) {
            const product = await ProductModel.findById(item.product);
            if (product) {
                product.stock += item.quantity;
                await product.save();
            }
        }

        order.orderStatus = "Cancelled";
        await order.save();

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
                formattedUser.picture = null; // Set to null if no picture
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
    cancelOrder,
    getWishlist,
    addToWishlist,
    removeFromWishlist,
    updateCartQuantity,
    searchUsers
};
