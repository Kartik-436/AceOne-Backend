const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    image: {
        data: {
            type: Buffer,
        },
        contentType: {
            type: String,
        }
    },
    name: {
        type: String,
    },
    price: {
        type: Number,
    },
    discountPrice: {
        type: Number,
    },
    discount: {
        type: Number,
    },
    customer: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Owner"
    },
    size: {
        type: String,
    },
    color: {
        type: String,
    },
    category: {
        type: String,
    },
    stock: {
        type: Number,
    },
}, {
    timestamps: true
});

const ProductModel = mongoose.model('Product', productSchema);

module.exports = ProductModel;
