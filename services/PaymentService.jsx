const crypto = require('crypto');
const axios = require('axios');
const Razorpay = require('razorpay');

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

const razorpayClient = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET
});

const createOrder = async (orderData) => {
    try {
        const options = {
            amount: orderData.amount * 100,
            currency: orderData.currency || 'INR',
            receipt: orderData.orderId || `receipt_${Date.now()}`,
            notes: {
                customerId: orderData.customerId,
                description: orderData.description
            }
        };

        const order = await razorpayClient.orders.create(options);

        return {
            orderId: order.id,
            amount: order.amount / 100,
            currency: order.currency,
            receipt: order.receipt,
            status: order.status
        };
    } catch (error) {
        console.error('Razorpay order creation failed:', error);
        throw new Error(error.message || 'Failed to create payment order');
    }
};

const verifyPaymentSignature = (paymentData) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = paymentData;

        const body = razorpay_order_id + '|' + razorpay_payment_id;

        const expectedSignature = crypto
            .createHmac('sha256', RAZORPAY_KEY_SECRET)
            .update(body)
            .digest('hex');

        return expectedSignature === razorpay_signature;
    } catch (error) {
        console.error('Signature verification failed:', error);
        return false;
    }
};


const capturePayment = async (paymentData) => {
    try {
        const isValid = verifyPaymentSignature(paymentData);

        if (!isValid) {
            throw new Error('Payment signature verification failed');
        }

        const payment = await razorpayClient.payments.fetch(paymentData.razorpay_payment_id);

        if (payment.status === 'authorized') {
            await razorpayClient.payments.capture(
                paymentData.razorpay_payment_id,
                payment.amount
            );
        }

        return {
            paymentId: payment.id,
            orderId: payment.order_id,
            status: payment.status,
            amount: payment.amount / 100,
            method: payment.method,
            email: payment.email,
            contact: payment.contact
        };
    } catch (error) {
        console.error('Razorpay payment capture failed:', error);
        throw new Error(error.message || 'Payment verification failed');
    }
};

const processRefund = async (refundData) => {
    try {
        const options = {
            payment_id: refundData.paymentId,
            amount: (refundData.amount || 0) * 100,
            notes: {
                reason: refundData.reason || 'Customer requested',
                ...refundData.metadata
            }
        };

        const refund = await razorpayClient.refunds.create(options);

        return {
            refundId: refund.id,
            paymentId: refund.payment_id,
            amount: refund.amount / 100,
            status: refund.status,
            createdAt: refund.created_at
        };
    } catch (error) {
        console.error('Razorpay refund processing failed:', error);
        throw new Error(error.message || 'Refund processing failed');
    }
};

const verifyWebhookSignature = (body, signature) => {
    try {
        const expectedSignature = crypto
            .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
            .update(body)
            .digest('hex');

        return expectedSignature === signature;
    } catch (error) {
        console.error('Webhook signature verification error:', error);
        return false;
    }
};

const processWebhookEvent = (event) => {

    const eventType = event.event;
    const payload = event.payload.payment || event.payload.order || event.payload.refund;

    switch (eventType) {
        case 'payment.authorized':
        case 'payment.captured':
            return {
                type: 'payment',
                status: payload.entity.status,
                paymentId: payload.entity.id,
                orderId: payload.entity.order_id,
                amount: payload.entity.amount / 100
            };

        case 'refund.processed':
            return {
                type: 'refund',
                status: payload.entity.status,
                refundId: payload.entity.id,
                paymentId: payload.entity.payment_id,
                amount: payload.entity.amount / 100
            };

        default:
            return {
                type: 'other',
                eventType,
                entityId: payload?.entity?.id
            };
    }
};

module.exports = {
    createOrder,
    capturePayment,
    verifyPaymentSignature,
    processRefund,
    verifyWebhookSignature,
    processWebhookEvent
};