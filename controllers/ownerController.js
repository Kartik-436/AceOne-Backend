const ownerModel = require('../models/owner.js');
const productModel = require('../models/product.js');
const userModel = require('../models/user.js');
const orderModel = require('../models/order.js');
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
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
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
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
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
        const Owner = await ownerModel.findOne({ email: req.user.email });

        if (!Owner) {
            return sendResponse(res, 404, false, "Owner not found");
        }

        sendResponse(res, 200, true, "Owner profile fetched", Owner);
    } catch (error) {
        sendResponse(res, 500, false, error.message);
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
        ).select('-password');

        sendResponse(res, 200, true, "Owner profile updated", { original: owner, updated: updatedOwner });
    } catch (error) {
        sendResponse(res, 500, false, error.message);
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
        sendResponse(res, 201, true, "product", product);
    } catch (error) {
        sendResponse(res, 500, false, "error", error.message);
    }
}

async function updateProduct(req, res) {
    try {
        let product = await productModel.findOne({ _id: req.params.id });
        if (!product) {
            return sendResponse(res, 404, "error", "Product not found");
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

        sendResponse(res, 200, true, "updatedProduct", { original: product, updated: updatedProduct });
    } catch (error) {
        sendResponse(res, 500, false, "error", error.message);
    }
}

async function deleteProduct(req, res) {
    try {
        let product = await productModel.findOne({ _id: req.params.id });
        if (!product) {
            return sendResponse(res, 404, "error", "Product not found");
        }

        await productModel.findOneAndDelete({ _id: req.params.id });
        sendResponse(res, 200, "message", "Product Deleted");
    } catch (error) {
        sendResponse(res, 500, "error", error.message);
    }
}

async function getAllProducts(req, res) {
    try {
        const products = await productModel.find({ owner: req.user.ID });
        sendResponse(res, 200, true, "products", products);
    } catch (error) {
        sendResponse(res, 500, "error", error.message);
    }
}

async function getProductById(req, res) {
    try {
        const product = await productModel.findOne({ _id: req.params.id });
        sendResponse(res, 200, true, "Product fetched successfully", product);
    } catch (error) {
        sendResponse(res, 500, false, error.message);
    }
}

async function getAllUsers(req, res) {
    try {
        const users = await userModel.find().select('-password');
        sendResponse(res, 200, true, "Users fetched successfully", users);
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

        await orderModel.deleteMany({ customer: req.params.id });
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
        const orders = await orderModel.find({ owner: req.user.ID })
            .populate("items.product") // Fixed population
            .populate("customer");

        sendResponse(res, 200, true, "Orders fetched successfully", orders);
    } catch (error) {
        sendResponse(res, 500, false, error.message);
    }
}

async function getSingleOrder(req, res) {
    try {
        const order = await orderModel.findById(req.params.id)
            .populate("items.product") // Fixed population
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
        let order = await orderModel.findById(req.params.id);
        if (!order) {
            return sendResponse(res, 404, false, "Order not found");
        }

        await orderModel.findByIdAndDelete(req.params.id);
        sendResponse(res, 200, true, "Order cancelled successfully");
    } catch (error) {
        sendResponse(res, 500, false, error.message);
    }
}

async function getRevenueStats(req, res) {
    try {
        const orders = await orderModel.find({ owner: req.user.ID }).populate("items.product");

        let sales = 0;
        let revenue = 0;

        orders.forEach(order => {
            order.items.forEach(item => {
                sales += item.quantity;
                const priceAfterDiscount = item.product.price * (1 - (item.product.discount || 0) / 100);
                revenue += item.quantity * priceAfterDiscount;
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
