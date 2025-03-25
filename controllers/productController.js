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


// Helper function to format product images as base64
function formatProductImage(product) {
    let formattedProduct = product;

    // If it's a Mongoose document, convert to plain object
    if (product.toObject) {
        formattedProduct = product.toObject();
    }

    // Convert main image to base64
    if (formattedProduct.image && formattedProduct.image.data) {
        formattedProduct.image = `data:${formattedProduct.image.contentType};base64,${formattedProduct.image.data.toString("base64")}`;
    }

    // Convert additional images to base64
    if (formattedProduct.additionalImages && formattedProduct.additionalImages.length) {
        formattedProduct.additionalImages = formattedProduct.additionalImages.map(img =>
            `data:${img.contentType};base64,${img.data.toString("base64")}`
        );
    }

    return formattedProduct;
}

// Format multiple products
function formatProductsWithImages(products) {
    return products.map(product => formatProductImage(product));
}

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

        // Format images as base64
        const formattedProducts = formatProductsWithImages(products);

        sendResponse(res, 200, true, 'Products retrieved successfully', formattedProducts);
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

        // Format image as base64
        const formattedProduct = formatProductImage(product);

        sendResponse(res, 200, true, 'Product retrieved successfully', formattedProduct);
    } catch (error) {
        sendResponse(res, 500, false, error.message);
    }
}

// Get best-selling products
async function getBestSellingProducts(req, res) {
    try {
        const products = await ProductModel.aggregate([
            { $match: { customer: { $exists: true, $ne: [] } } }, // Include products with at least one customer
            { $addFields: { customerCount: { $size: "$customer" } } }, // Add a virtual field for customer count
            { $sort: { customerCount: -1 } }, // Sort by number of customers in descending order
            { $limit: 12 } // Retrieve top 12 best-selling products
        ]);

        // For aggregation results, we need to handle image formatting slightly differently
        const formattedProducts = products.map(product => {
            if (product.image && product.image.data) {
                // Convert Buffer to base64 string
                // Note: With aggregation, data might be Binary data not Buffer
                const imageData = product.image.data.buffer ?
                    product.image.data.buffer.toString("base64") :
                    product.image.data.toString("base64");

                return {
                    ...product,
                    image: `data:${product.image.contentType};base64,${imageData}`
                };
            }
            return product;
        });

        sendResponse(res, 200, true, 'Best-selling products retrieved', formattedProducts);
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

        // Format images as base64
        const formattedProducts = formatProductsWithImages(products);

        sendResponse(res, 200, true, 'Discounted products retrieved', formattedProducts);
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

        // Format images as base64
        const formattedProducts = formatProductsWithImages(products);

        sendResponse(res, 200, true, 'Search results retrieved', formattedProducts);
    } catch (error) {
        sendResponse(res, 500, false, error.message);
    }
}

// Uncomment and update if needed
/*
async function getProductByName(req, res) {
  try {
    const { productName } = req.params;  // Extract product name from request parameters
    const product = await ProductModel.findOne({ name: { $regex: new RegExp(productName, 'i') } });
 
    if (!product) {
      return sendResponse(res, 404, false, 'Product not found');
    }
    
    // Format image as base64
    const formattedProduct = formatProductImage(product);
 
    sendResponse(res, 200, true, 'Product retrieved successfully', formattedProduct);
  } catch (error) {
    sendResponse(res, 500, false, error.message);
  }
}
*/

module.exports = { getAllProducts, getProductById, getBestSellingProducts, getDiscountedProducts, searchProducts };
