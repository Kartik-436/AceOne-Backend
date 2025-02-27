// Required Modules
const express = require('express');

// Required Environment Variables
require('dotenv').config();

// Required Models
const ProductModel = require('../models/product.js');

// Express Router
const router = express.Router();

// Response Sender
const sendResponse = require('../utils/Send-Response.js');

// Debugger
const dbgr = require('debug')('development:productController');


// http://localhost:5000/products?sort=price:asc
// http://localhost:5000/products?category=shoes&sort=name:desc
// http://localhost:5000/products?minPrice=200&maxPrice=800
// http://localhost:5000/products?category=shoes&minPrice=200&maxPrice=800&sort=price:asc
// http://localhost:5000/products?category=shoes&minPrice=200&maxPrice=800&sort=price:desc


// Get all products with sorting feature
async function getAllProducts(req, res) {
    try {
        const { sort, category, minPrice, maxPrice } = req.query;
        let filterOptions = {};
        let sortOptions = {};

        // Apply category filter if provided
        if (category) {
            filterOptions.category = category;
        }

        // Apply price range filter if provided
        if (minPrice || maxPrice) {
            filterOptions.price = {};
            if (minPrice) filterOptions.price.$gte = parseFloat(minPrice);
            if (maxPrice) filterOptions.price.$lte = parseFloat(maxPrice);
        }

        // Apply sorting if provided
        if (sort) {
            const [key, order] = sort.split(':'); // Example: ?sort=price:desc
            const sortOrder = order === 'desc' ? -1 : 1;

            if (['name', 'price'].includes(key)) {
                sortOptions[key] = sortOrder;
            }
        }

        // Fetch products with filtering and sorting
        const products = await ProductModel.find(filterOptions).sort(sortOptions);

        sendResponse(res, 200, true, 'Products retrieved successfully', products);
    } catch (error) {
        sendResponse(res, 500, false, error.message);
    }
}

// Get single product details
async function getProductById(req, res) {
    try {
        const { productId } = req.params;
        const product = await ProductModel.findById(productId);
        if (!product) {
            return sendResponse(res, 404, false, 'Product not found');
        }
        sendResponse(res, 200, true, 'Product retrieved successfully', product);
    } catch (error) {
        sendResponse(res, 500, false, error.message);
    }
}

// Get single product details
// async function getProductByName(req, res) {
//     try {
//         const { productName } = req.params;  // Extract product name from request parameters
//         const product = await ProductModel.findOne({ name: { $regex: new RegExp(productName, 'i') } });

//         if (!product) {
//             return sendResponse(res, 404, false, 'Product not found');
//         }

//         sendResponse(res, 200, true, 'Product retrieved successfully', product);
//     } catch (error) {
//         sendResponse(res, 500, false, error.message);
//     }
// }


// Get best-selling products
async function getBestSellingProducts(req, res) {
    try {
        const products = await ProductModel.aggregate([
            { $match: { customer: { $exists: true, $ne: [] } } }, // Include products with at least one customer
            { $addFields: { customerCount: { $size: "$customer" } } }, // Add a virtual field for customer count
            { $sort: { customerCount: -1 } }, // Sort by number of customers in descending order
            { $limit: 12 } // Retrieve top 12 best-selling products
        ]);

        sendResponse(res, 200, true, 'Best-selling products retrieved', products);
    } catch (error) {
        sendResponse(res, 500, false, error.message);
    }
}


// Get products with discounts
async function getDiscountedProducts(req, res) {
    try {
        const products = await ProductModel.find({ discount: { $gt: 0 } }) // Get products with a discount > 0
            .sort({ discount: -1 }); // Sort by discount in descending order

        if (!products.length) {
            return sendResponse(res, 200, true, "No discounted products available", []);
        }

        sendResponse(res, 200, true, 'Discounted products retrieved', products);
    } catch (error) {
        sendResponse(res, 500, false, error.message);
    }
}


// Search products
async function searchProducts(req, res) {
    try {
        const query = req.query.q?.trim();

        if (!query) {
            return sendResponse(res, 400, false, 'Query parameter is required');
        }

        const products = await ProductModel.find({
            name: { $regex: new RegExp(query, "i") }
        });

        sendResponse(res, 200, true, 'Search results retrieved', products);
    } catch (error) {
        sendResponse(res, 500, false, error.message);
    }
}

module.exports = { getAllProducts, getProductById, getBestSellingProducts, getDiscountedProducts, searchProducts };
