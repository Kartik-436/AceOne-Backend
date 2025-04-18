const mongoose = require('mongoose');

const OrderSchema = mongoose.Schema({
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity: {
            type: Number,
            required: true,
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
    }],
    totalAmount: {
        type: Number,
        required: true
    },
    discountedTotalAmount: {
        type: Number
    },
    deliveryFee: {
        type: Number,
        default: 50
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Owner',
        required: true
    },
    orderDate: {
        type: Date,
        default: Date.now
    },
    modeOfPayment: {
        type: String,
        enum: ["Online", "Cash on Delivery"],
        required: true
    },
    orderStatus: {
        type: String,
        enum: ["Awaiting Payment", "Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled", "Payment Failed"],
        default: "Pending"
    },
    payment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment'
    },
    cancelledAt: Date,
    cancellationReason: String,
    deliveredAt: Date,
    invoiceNumber: String
}, {
    timestamps: true
});

const OrderModel = mongoose.model('Order', OrderSchema);
module.exports = OrderModel;