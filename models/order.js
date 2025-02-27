const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    items: [
        {
            product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
            quantity: { type: Number, required: true },
        },
    ],

    totalAmount: { type: Number, required: true },

    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Owner',
    },

    orderDate: {
        type: Date,
        default: Date.now
    }
});

const OrderModel = mongoose.model('Order', orderSchema);
module.exports = OrderModel;