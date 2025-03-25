const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    image: {
        data: { type: Buffer },
        contentType: { type: String }
    },
    additionalImages: [{
        data: { type: Buffer },
        contentType: { type: String }
    }],
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    brand: {
        type: String,
        default: "AceOne"
    },
    price: {
        type: Number,
        required: true
    },
    discountPrice: {
        type: Number,
    },
    discount: {
        type: Number,
        min: 0,
        max: 100,
        required: true
    },
    customer: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Owner"
    },
    size: [{
        type: String,
        required: true
    }],
    color: [{
        type: String,
        required: true
    }],
    category: {
        type: String,
        required: true
    },
    stock: {
        type: Number,
        required: true
    },
    ratings: {
        type: Number,
        default: 0
    },
    reviews: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        rating: {
            type: Number,
            required: true
        },
        comment: {
            type: String,
            required: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

const ProductModel = mongoose.model('Product', productSchema);

module.exports = ProductModel;
