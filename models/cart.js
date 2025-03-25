const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: false
    },
    sessionId: {
        type: String,
        required: false
    },
    items: [
        {
            productId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Product",
                required: true
            },
            quantity: {
                type: Number,
                required: true,
                default: 1,
                min: 1
            },
            selectedSize: {
                type: String,
                required: true
            },
            selectedColor: {
                type: String,
                required: true
            },
            price: {
                type: Number,
                required: true
            },
            discountPrice: {
                type: Number
            }
        }
    ]
}, {
    timestamps: true
});

const CartModel = mongoose.model('Cart', cartSchema);
module.exports = CartModel;