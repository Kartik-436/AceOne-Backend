const express = require('express');
const router = express.Router();
const { verifyWebhookSignature, processWebhookEvent } = require('../services/PaymentService.jsx');
const ProductModel = require('../models/product.js');
const UserModel = require('../models/user.js');
const OrderModel = require('../models/order.js');
const wishModel = require('../models/wishlist.js');
const CartModel = require('../models/cart.js')
const PaymentModel = require("../models/payment.js")
const InvoiceModel = require("../models/invoice.js")
const { generateInvoice } = require("../utils/Generate-Invoice")

router.post('/razorpay', async (req, res) => {
    try {
        const signature = req.headers['x-razorpay-signature'];
        const requestBody = JSON.stringify(req.body);

        if (!signature || !verifyWebhookSignature(requestBody, signature)) {

            return res.status(401).json({ success: false, message: "Invalid signature" });
        }

        const event = req.body;
        const processedEvent = processWebhookEvent(event);

        switch (event.event) {
            case 'payment.authorized':
                await handlePaymentAuthorized(processedEvent);
                break;

            case 'payment.captured':
                await handlePaymentCaptured(processedEvent);
                break;

            case 'payment.failed':
                await handlePaymentFailed(processedEvent);
                break;

            case 'refund.processed':
                await handleRefundProcessed(processedEvent);
                break;
        }


        res.status(200).json({ success: true, message: "Webhook received and processed" });
    } catch (err) {
        res.status(200).json({ success: false, message: "Webhook received but processing failed" });
    }
});

module.exports.webhookRouter = router;

/**
 * Handle payment.authorized event
 * This is triggered when a payment is authorized but not yet captured
 */
async function handlePaymentAuthorized(eventData) {
    try {

        const payment = await PaymentModel.findOneAndUpdate(
            { razorpayOrderId: eventData.orderId },
            {
                paymentId: eventData.paymentId,
                status: eventData.status,
                updatedAt: new Date()
            },
            { new: true }
        );

        if (!payment) {

            return;
        }


        await OrderModel.findByIdAndUpdate(
            payment.order,
            { orderStatus: 'Payment Authorized' },
            { new: true }
        );
    } catch (err) {

        throw err;
    }
}

/**
 * Handle payment.captured event
 * This is triggered when a payment is successfully captured
 */
async function handlePaymentCaptured(eventData) {
    try {

        const payment = await PaymentModel.findOneAndUpdate(
            { razorpayOrderId: eventData.orderId },
            {
                paymentId: eventData.paymentId,
                status: 'captured',
                updatedAt: new Date()
            },
            { new: true }
        );

        if (!payment) {

            return;
        }


        const order = await OrderModel.findById(payment.order);

        if (!order) {

            return;
        }


        order.orderStatus = 'Confirmed';
        await order.save();


        for (let item of order.items) {
            const product = await ProductModel.findById(item.product);
            if (product) {
                product.stock -= item.quantity;


                if (!product.customer.includes(order.customer)) {
                    product.customer.push(order.customer);
                }

                await product.save();
            }
        }


        try {
            await generateInvoice(order._id);
        } catch (invoiceErr) {

        }
    } catch (err) {

        throw err;
    }
}

/**
 * Handle payment.failed event
 * This is triggered when a payment fails
 */
async function handlePaymentFailed(eventData) {
    try {

        const payment = await PaymentModel.findOneAndUpdate(
            { razorpayOrderId: eventData.orderId },
            {
                paymentId: eventData.paymentId,
                status: 'failed',
                updatedAt: new Date()
            },
            { new: true }
        );

        if (!payment) {

            return;
        }


        await OrderModel.findByIdAndUpdate(
            payment.order,
            { orderStatus: 'Payment Failed' },
            { new: true }
        );
    } catch (err) {

        throw err;
    }
}

/**
 * Handle refund.processed event
 * This is triggered when a refund is processed
 */
async function handleRefundProcessed(eventData) {
    try {

        const payment = await PaymentModel.findOneAndUpdate(
            { paymentId: eventData.paymentId },
            {
                refundId: eventData.refundId,
                refundStatus: eventData.status,
                refundedAt: new Date()
            },
            { new: true }
        );

        if (!payment) {

            return;
        }


        const order = await OrderModel.findById(payment.order);

        if (order && order.orderStatus !== 'Cancelled') {
            order.orderStatus = 'Cancelled';
            order.cancelledAt = new Date();
            order.cancellationReason = 'Refunded via Razorpay webhook';
            await order.save();
        }
    } catch (err) {

        throw err;
    }
}
