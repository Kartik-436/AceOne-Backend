const express = require('express');
const router = express.Router();
const { verifyWebhookSignature, processWebhookEvent } = require('../services/PaymentService.jsx');
const OrderModel = require('../models/OrderModel');
const ProductModel = require('../models/ProductModel');
const PaymentModel = require('../models/PaymentModel');
const { generateInvoice } = require("../utils/Generate-Invoice")
const dbgr = console.error;

router.post('/razorpay', async (req, res) => {
    try {
        const signature = req.headers['x-razorpay-signature'];
        const requestBody = JSON.stringify(req.body);

        if (!signature || !verifyWebhookSignature(requestBody, signature)) {
            dbgr("Webhook Signature Verification Failed");
            return res.status(401).json({ success: false, message: "Invalid signature" });
        }


        const event = req.body;
        const processedEvent = processWebhookEvent(event);
        dbgr("Razorpay Webhook Event:", event.event, processedEvent);


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
        dbgr("Webhook Error:", err.message);

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
            dbgr("Payment record not found for authorized payment:", eventData.paymentId);
            return;
        }


        await OrderModel.findByIdAndUpdate(
            payment.order,
            { orderStatus: 'Payment Authorized' },
            { new: true }
        );
    } catch (err) {
        dbgr("Error handling payment.authorized:", err.message);
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
            dbgr("Payment record not found for captured payment:", eventData.paymentId);
            return;
        }


        const order = await OrderModel.findById(payment.order);

        if (!order) {
            dbgr("Order not found for payment:", payment._id);
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
            dbgr("Invoice Generation Error:", invoiceErr);
        }
    } catch (err) {
        dbgr("Error handling payment.captured:", err.message);
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
            dbgr("Payment record not found for failed payment:", eventData.paymentId);
            return;
        }


        await OrderModel.findByIdAndUpdate(
            payment.order,
            { orderStatus: 'Payment Failed' },
            { new: true }
        );
    } catch (err) {
        dbgr("Error handling payment.failed:", err.message);
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
            dbgr("Payment record not found for refund:", eventData.refundId);
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
        dbgr("Error handling refund.processed:", err.message);
        throw err;
    }
}
