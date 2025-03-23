const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
    invoiceNumber: {
        type: String,
        required: true,
        unique: true
    },
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    invoiceDate: {
        type: Date,
        default: Date.now
    },
    items: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product'
        },
        productName: String,
        quantity: Number,
        price: Number,
        amount: Number
    }],
    subtotal: Number,
    deliveryFee: Number,
    totalAmount: Number,
    paymentMethod: String,
    paymentStatus: String,
    pdfContent: {
        type: Buffer,
        required: true
    },
    contentType: {
        type: String,
        default: 'application/pdf'
    }
});

const InvoiceModel = mongoose.model('Invoice', invoiceSchema);
module.exports = InvoiceModel;