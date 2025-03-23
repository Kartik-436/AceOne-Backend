const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'INR'
    },
    razorpayOrderId: String,
    paymentId: String,
    signature: String,
    status: {
        type: String,
        enum: ['created', 'authorized', 'captured', 'failed', 'refunded'],
        default: 'created'
    },
    method: String,
    refundId: String,
    refundStatus: String,
    refundedAt: Date,
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: Date
});

const PaymentModel = mongoose.model('Payment', PaymentSchema);
module.exports = PaymentModel;