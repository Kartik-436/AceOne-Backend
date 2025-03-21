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
    res.clearCookie("token");
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
        let discountPrice = 0;
        const { name, price, discount, size, color, category, stock } = req.body;
        if (discount !== undefined && discount !== null) {
            let disc = (price * discount) / 100;
            discountPrice = price - disc;
        }

        const product = new productModel({
            name,
            price,
            discount,
            discountPrice: discountPrice,
            size,
            color,
            category,
            stock,
            owner: req.user.ID
        });

        if (req.file) {
            product.image = {
                data: req.file.buffer,
                contentType: req.file.mimetype,
            };
        }

        await product.save();

        let base64Image = null;
        if (product.image && product.image.data) {
            base64Image = `data:${product.image.contentType};base64,${product.image.data.toString("base64")}`;
        }

        sendResponse(res, 201, true, "Product added successfully", {
            ...product.toObject(),
            image: base64Image,
        });
    } catch (error) {
        sendResponse(res, 500, false, "error", error.message);
    }
}

async function updateProduct(req, res) {
    try {
        let product = await productModel.findOne({ _id: req.params.id });
        if (!product) {
            return sendResponse(res, 404, false, "Product not found");
        }

        const { name, price, discount, size, color, category, stock } = req.body;
        let updateFields = { name, price, discount, size, color, category, stock };

        updateFields = Object.fromEntries(
            Object.entries(updateFields).filter(([_, value]) => value !== undefined && value !== null)
        );

        if (req.file) {
            updateFields.image = {
                data: req.file.buffer,
                contentType: req.file.mimetype,
            };
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
        sendResponse(res, 500, false, "error", error.message);
    }
}

async function deleteProduct(req, res) {
    try {
        let product = await productModel.findOne({ _id: req.params.id });
        if (!product) {
            return sendResponse(res, 404, false, "Product not found");
        }

        await productModel.findOneAndDelete({ _id: req.params.id });
        sendResponse(res, 200, true, "Product Deleted");
    } catch (error) {
        sendResponse(res, 500, false, "error", error.message);
    }
}

async function getAllProducts(req, res) {
    try {
        const products = await productModel.find({ owner: req.user.ID });

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
        sendResponse(res, 500, false, "error", error.message);
    }
}

async function getProductById(req, res) {
    try {
        const product = await productModel.findOne({ _id: req.params.id });

        if (!product) {
            return sendResponse(res, 404, false, "Product not found");
        }

        let base64Image = null;
        if (product.image && product.image.data) {
            base64Image = `data:${product.image.contentType};base64,${product.image.data.toString("base64")}`;
        }

        sendResponse(res, 200, true, "Product fetched successfully", {
            ...product.toObject(),
            image: base64Image,
        });
    } catch (error) {
        sendResponse(res, 500, false, "error", error.message);
    }
}

async function getAllUsers(req, res) {
    try {
        const users = await userModel.find().select('-password').populate({
            path: 'orders',
            populate: {
                path: 'items',
                populate: {
                    path: 'product',
                    model: 'Product'
                }
            }
        });

        const formattedUsers = users.map(user => {
            let base64Image = null;
            if (user.picture && user.picture.data) {
                base64Image = `data:${user.picture.contentType};base64,${user.picture.data.toString("base64")}`;
            }

            return {
                ...user.toObject(),
                picture: base64Image, // Will be null if no valid picture data
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

        await OrderModel.deleteMany({ customer: req.params.id });
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
            .populate("customer");

        sendResponse(res, 200, true, "Orders fetched successfully", orders);
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
        const orders = await OrderModel.find().populate("items.product");

        let sales = 0;
        let revenue = 0;

        orders.forEach(order => {
            if (order.orderStatus !== "Cancelled") {
                order.items.forEach(item => {
                    sales += item.quantity;
                    const priceAfterDiscount = item.product.price * (1 - (item.product.discount || 0) / 100);
                    revenue += item.quantity * priceAfterDiscount;
                });
            }
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
