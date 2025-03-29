const ownerModel = require('../models/owner.js');
const productModel = require('../models/product.js');
const userModel = require('../models/user.js');
const OrderModel = require('../models/order.js');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const sendResponse = require('../utils/Send-Response.js');
require('dotenv').config();

// Debugger
const dbgr = require('debug')('development:ownerController');

// Rate limiting configuration
const loginLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 5
});

dbgr("ownerModel:", ownerModel);

async function registerOwner(req, res) {
    try {
        let owner = await ownerModel.find();
        if (owner.length > 0) {
            return sendResponse(res, 403, false, "You are not allowed to register as owner");
        }

        const { fullName, email, password, contact, dateOfBirth } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);

        const newOwner = new ownerModel({
            fullName,
            email,
            password: hashedPassword,
            contact,
            dateOfBirth: new Date(dateOfBirth)
        });
        await newOwner.save();

        const token = jwt.sign(
            { email: newOwner.email, ID: newOwner._id, role: "owner" },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: true,
            sameSite: "None",
            maxAge: 24 * 60 * 60 * 1000
        });

        const ownerResponse = await ownerModel.findById(newOwner._id).select('-password');
        sendResponse(res, 201, true, "Owner registered successfully", ownerResponse);
    } catch (error) {
        sendResponse(res, 500, false, error.message);
    }
}

async function loginOwner(req, res) {
    try {
        const { email, password } = req.body;
        const owner = await ownerModel.findOne({ email });
        if (!owner) {
            return sendResponse(res, 401, false, "Invalid Credentials");
        }

        const isMatch = await bcrypt.compare(password, owner.password);
        if (!isMatch) {
            return sendResponse(res, 401, false, "Invalid Credentials");
        }

        const token = jwt.sign(
            { email: owner.email, ID: owner._id, role: "owner" },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: true,
            sameSite: "None",
            maxAge: 24 * 60 * 60 * 1000
        });

        sendResponse(res, 200, true, "Owner Logged In", owner);
    } catch (error) {
        sendResponse(res, 500, false, error.message);
    }
}

async function logOutOwner(req, res) {
    res.clearCookie("token", {
        httpOnly: true,
        secure: true,
        sameSite: "None",
    });

    // Add cache control headers
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    sendResponse(res, 200, true, "Owner Logged Out");
}

async function getOwnerProfile(req, res) {
    try {
        const owner = await ownerModel.findOne({ email: req.user.email }).select('-password');

        if (!owner) {
            return sendResponse(res, 404, false, "Owner not found");
        }

        let base64Image = null;
        if (owner.picture && owner.picture.data) {
            base64Image = `data:${owner.picture.contentType};base64,${owner.picture.data.toString("base64")}`;
        }

        sendResponse(res, 200, true, "Owner profile fetched", {
            ...owner.toObject(),
            picture: base64Image,
        });
    } catch (error) {
        sendResponse(res, 500, false, "error", error.message);
    }
}

async function updateOwnerProfile(req, res) {
    try {
        let owner = await ownerModel.findOne({ email: req.user.email }).select('-password');
        if (!owner) {
            return sendResponse(res, 404, false, "Owner not found");
        }

        const { fullName, email, contact, dateOfBirth, gstNo } = req.body;
        let updateFields = { fullName, email, contact, dateOfBirth, gstNo };

        updateFields = Object.fromEntries(
            Object.entries(updateFields).filter(([_, value]) => value !== undefined && value !== null)
        );

        if (req.file) {
            updateFields.picture = {
                data: req.file.buffer,
                contentType: req.file.mimetype,
            };
        }

        const updatedOwner = await ownerModel.findOneAndUpdate(
            { email: req.user.email },
            updateFields,
            { new: true }
        );

        let base64Image = null;
        if (updatedOwner.picture && updatedOwner.picture.data) {
            base64Image = `data:${updatedOwner.picture.contentType};base64,${updatedOwner.picture.data.toString("base64")}`;
        }

        sendResponse(res, 200, true, "Owner profile updated", {
            ...updatedOwner.toObject(),
            picture: base64Image,
        });
    } catch (error) {
        sendResponse(res, 500, false, "error", error.message);
    }
}

async function deleteOwner(req, res) {
    try {
        let owner = await ownerModel.findOne({ email: req.user.email }).select('-password');
        if (!owner) {
            return sendResponse(res, 404, "error", "Owner not found");
        }

        await ownerModel.findOneAndDelete({ email: req.user.email });
        await productModel.deleteMany({ owner: owner._id });

        sendResponse(res, 200, true, "message", "Owner Deleted");
    } catch (error) {
        sendResponse(res, 500, true, "error", error.message);
    }
}

async function addProduct(req, res) {
    try {
        const { name, description, price, discount, size, color, category, stock } = req.body;

        // Comprehensive validation (mostly good as is)
        if (!name || name.trim() === '') {
            return sendResponse(res, 400, false, "Product name is required");
        }

        // Discount and price calculation
        let discountPrice = price;
        if (discount !== undefined && discount !== null) {
            if (discount < 0 || discount > 100) {
                return sendResponse(res, 400, false, "Discount must be between 0 and 100");
            }
            discountPrice = Number((price * (1 - discount / 100)).toFixed(2));
        }

        const product = new productModel({
            name,
            description,
            price,
            discount,
            discountPrice,
            size: Array.isArray(size) ? size : [size], // Ensure size is an array
            color: Array.isArray(color) ? color : [color], // Ensure color is an array
            category,
            stock,
            owner: req.user.ID,
            ratings: 0, // Initialize ratings
            reviews: [] // Initialize empty reviews array
        });

        if (req.files && req.files.image && req.files.image[0]) {
            const mainImageFile = req.files.image[0];
            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
            const maxSize = 5 * 1024 * 1024; // 5MB

            if (!allowedTypes.includes(mainImageFile.mimetype)) {
                return sendResponse(res, 400, false, "Invalid image type");
            }

            if (mainImageFile.size > maxSize) {
                return sendResponse(res, 400, false, "Image size should be less than 5MB");
            }

            product.image = {
                data: mainImageFile.buffer,
                contentType: mainImageFile.mimetype,
            };
        }

        // Additional images handling (looks good)
        if (req.files && req.files.additionalImages) {
            product.additionalImages = req.files.additionalImages.map(file => ({
                data: file.buffer,
                contentType: file.mimetype
            }));
        }

        await product.save();

        // Convert image to base64 for response (looks good)
        let base64Image = null;
        if (product.image && product.image.data) {
            base64Image = `data:${product.image.contentType};base64,${product.image.data.toString("base64")}`;
        }

        sendResponse(res, 201, true, "Product added successfully", {
            ...product.toObject(),
            image: base64Image,
        });
    } catch (error) {
        console.error('Product addition error:', error);
        sendResponse(res, 500, false, "Error adding product", error.message);
    }
}

async function updateProduct(req, res) {
    try {
        let product = await productModel.findOne({ _id: req.params.id });
        if (!product) {
            return sendResponse(res, 404, false, "Product not found");
        }

        const { name, description, price, discount, size, color, category, stock } = req.body;
        let updateFields = {
            name,
            description,
            price,
            discount,
            size: Array.isArray(size) ? size : (size ? [size] : undefined),
            color: Array.isArray(color) ? color : (color ? [color] : undefined),
            category,
            stock
        };

        // Remove undefined or null fields
        updateFields = Object.fromEntries(
            Object.entries(updateFields).filter(([_, value]) => value !== undefined && value !== null)
        );

        // Recalculate discount price
        if (updateFields.price !== undefined || updateFields.discount !== undefined) {
            const currentPrice = updateFields.price || product.price;
            const currentDiscount = updateFields.discount !== undefined
                ? updateFields.discount
                : product.discount;

            if (currentDiscount !== undefined && currentDiscount !== null) {
                updateFields.discountPrice = Number((currentPrice * (1 - currentDiscount / 100)).toFixed(2));
            }
        }

        if (req.files && req.files.image && req.files.image[0]) {
            const mainImageFile = req.files.image[0];
            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
            const maxSize = 5 * 1024 * 1024; // 5MB

            if (!allowedTypes.includes(mainImageFile.mimetype)) {
                return sendResponse(res, 400, false, "Invalid image type");
            }

            if (mainImageFile.size > maxSize) {
                return sendResponse(res, 400, false, "Image size should be less than 5MB");
            }

            updateFields.image = {
                data: mainImageFile.buffer,
                contentType: mainImageFile.mimetype,
            };
        }

        // Additional images handling (looks good)
        if (req.files && req.files.additionalImages) {
            updateFields.additionalImages = req.files.additionalImages.map(file => ({
                data: file.buffer,
                contentType: file.mimetype
            }));
        }

        const updatedProduct = await productModel.findOneAndUpdate(
            { _id: req.params.id },
            updateFields,
            { new: true }
        );

        let base64Image = null;
        if (updatedProduct.image && updatedProduct.image.data) {
            base64Image = `data:${updatedProduct.image.contentType};base64,${updatedProduct.image.data.toString("base64")}`;
        }

        sendResponse(res, 200, true, "Product updated successfully", {
            ...updatedProduct.toObject(),
            image: base64Image,
        });
    } catch (error) {
        sendResponse(res, 500, false, "Error updating product", error.message);
    }
}

async function deleteProduct(req, res) {
    try {
        let product = await productModel.findOne({ _id: req.params.id });
        if (!product) {
            return sendResponse(res, 404, false, "Product not found");
        }

        await productModel.findOneAndDelete({ _id: req.params.id });
        sendResponse(res, 200, true, "Product deleted successfully");
    } catch (error) {
        sendResponse(res, 500, false, "Error deleting product", error.message);
    }
}

async function getAllProducts(req, res) {
    try {
        const products = await productModel.find({ owner: req.user.ID })
            .sort({ createdAt: -1 }); // Sort by most recent first

        const formattedProducts = products.map(product => {
            let base64Image = null;
            if (product.image && product.image.data) {
                base64Image = `data:${product.image.contentType};base64,${product.image.data.toString("base64")}`;
            }

            return {
                ...product.toObject(),
                image: base64Image,
            };
        });

        sendResponse(res, 200, true, "Products fetched successfully", formattedProducts);
    } catch (error) {
        sendResponse(res, 500, false, "Error fetching products", error.message);
    }
}

async function getProductById(req, res) {
    try {
        const product = await productModel.findOne({ _id: req.params.id })
            .populate('reviews.user', 'name email'); // Optionally populate user details for reviews

        if (!product) {
            return sendResponse(res, 404, false, "Product not found");
        }

        let base64Image = null;
        if (product.image && product.image.data) {
            base64Image = `data:${product.image.contentType};base64,${product.image.data.toString("base64")}`;
        }

        // Convert additional images to base64 if exists
        const base64AdditionalImages = product.additionalImages
            ? product.additionalImages.map(img =>
                `data:${img.contentType};base64,${img.data.toString("base64")}`
            )
            : [];

        sendResponse(res, 200, true, "Product fetched successfully", {
            ...product.toObject(),
            image: base64Image,
            additionalImages: base64AdditionalImages
        });
    } catch (error) {
        sendResponse(res, 500, false, "Error fetching product", error.message);
    }
}

async function getAllUsers(req, res) {
    try {
        const users = await userModel.find()
            .select('-password') // Exclude password
            .populate({
                path: 'orders',
                populate: 'items.product'
            })
            .lean(); // Convert Mongoose documents to plain objects for efficiency

        // Format Users
        const formattedUsers = users.map(user => {
            // Convert user's profile picture to Base64
            let base64ProfileImage = null;
            if (user.picture?.data && user.picture?.contentType) {
                base64ProfileImage = `data:${user.picture.contentType};base64,${user.picture.data.toString("base64")}`;
            }

            // Convert order items' product images to Base64
            const formattedOrders = user.orders.map(order => ({
                ...order,
                items: order.items.map(item => {
                    if (item.product?.image) {
                        base64ProductImage = `data:${item.product?.image.contentType};base64,${item.product?.image.data.toString("base64")}`;
                        return {
                            ...item,
                            product: {
                                ...item.product,
                                image: base64ProductImage
                            }
                        };
                    }
                    return item;
                })
            }));

            return {
                ...user,
                picture: base64ProfileImage, // Converted user profile picture
                orders: formattedOrders // Orders with product images converted to Base64
            };
        });

        sendResponse(res, 200, true, "Users fetched successfully", formattedUsers);
    } catch (error) {
        sendResponse(res, 500, false, error.message);
    }
}

async function getSingleUser(req, res) {
    try {
        const user = await userModel.findOne({ _id: req.params.id }).select('-password');
        sendResponse(res, 200, true, "User fetched successfully", user);
    } catch (error) {
        sendResponse(res, 500, false, error.message);
    }
}

async function deleteUser(req, res) {
    try {
        const user = await userModel.findById(req.params.id);
        if (!user) {
            return sendResponse(res, 404, false, "User not found");
        }

        // Delete user's orders
        await OrderModel.deleteMany({ customer: req.params.id });

        // Remove user references from products
        await productModel.updateMany(
            { customer: req.params.id },
            { $pull: { customer: req.params.id } }
        );

        // Delete the user
        await userModel.findByIdAndDelete(req.params.id);

        sendResponse(res, 200, true, "User deleted successfully");
    } catch (error) {
        sendResponse(res, 500, false, error.message);
    }
}

async function applyDiscount(req, res) {
    try {
        let product = await productModel.findById(req.params.id);
        if (!product) {
            return sendResponse(res, 404, false, "Product not found");
        }

        product.discount = req.body.discount;
        await product.save();

        sendResponse(res, 200, true, "Discount applied successfully", product);
    } catch (error) {
        sendResponse(res, 500, false, error.message);
    }
}

async function removeDiscount(req, res) {
    try {
        let product = await productModel.findById(req.params.id);
        if (!product) {
            return sendResponse(res, 404, false, "Product not found");
        }

        product.discount = 0;
        await product.save();

        sendResponse(res, 200, true, "Discount removed successfully", product);
    } catch (error) {
        sendResponse(res, 500, false, error.message);
    }
}

async function getAllOrders(req, res) {
    try {
        const orders = await OrderModel.find()
            .populate("items.product")
            .populate("customer")
            .lean(); // Converts to plain JS object for better performance

        // Convert product images to Base64
        const updatedOrders = orders.map(order => ({
            ...order,
            items: order.items.map(item => {
                if (item.product?.image) {
                    // Convert image to Base64 if it's stored as Buffer
                    base64Image = `data:${item.product.image.contentType};base64,${item.product.image.data.toString("base64")}`;
                    return {
                        ...item,
                        product: {
                            ...item.product,
                            image: base64Image
                        }
                    };
                }
                return item;
            })
        }));

        sendResponse(res, 200, true, "Orders fetched successfully", updatedOrders);
    } catch (error) {
        sendResponse(res, 500, false, error.message);
    }
}

async function getSingleOrder(req, res) {
    try {
        const order = await OrderModel.findById(req.params.id)
            .populate("items.product")
            .populate("customer");

        if (!order) {
            return sendResponse(res, 404, false, "Order not found");
        }

        sendResponse(res, 200, true, "Order fetched successfully", order);
    } catch (error) {
        sendResponse(res, 500, false, error.message);
    }
}

async function deleteOrder(req, res) {
    try {
        let order = await OrderModel.findById(req.params.id);
        if (!order) {
            return sendResponse(res, 404, false, "Order not found");
        }

        if (order.orderStatus !== "Pending") {
            return sendResponse(res, 400, false, "Only pending orders can be deleted.");
        }

        await OrderModel.findByIdAndDelete(req.params.id);
        sendResponse(res, 200, true, "Order cancelled successfully");
    } catch (error) {
        sendResponse(res, 500, false, error.message);
    }
}

async function getRevenueStats(req, res) {
    try {
        const orders = await OrderModel.find({
            orderStatus: { $ne: "Cancelled" }
        }).populate({
            path: 'items.product',
            select: 'price discountPrice discount'
        });

        let sales = 0;
        let revenue = 0;

        orders.forEach(order => {
            order.items.forEach(item => {
                sales += item.quantity;
                // Use the discountPrice from the product if available, otherwise calculate
                const priceToUse = item.product.discountPrice ||
                    item.product.price * (1 - (item.product.discount || 0) / 100);
                revenue += item.quantity * priceToUse;
            });
        });

        sendResponse(res, 200, true, "Revenue statistics fetched successfully", { sales, revenue });
    } catch (error) {
        sendResponse(res, 500, false, error.message);
    }
}

module.exports = {
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
};
