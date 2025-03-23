const ProductModel = require('../models/product.js');
const UserModel = require('../models/user.js');
const OrderModel = require('../models/order.js');
const InvoiceModel = require('../models/invoice');
const PDFDocument = require('pdfkit');
const path = require('path');

async function generateInvoice(order) {
    try {
        if (!order) throw new Error("Order data is missing");

        // Generate a unique invoice number
        const invoiceNumber = `INV-${order._id.toString().substring(0, 8)}-${Date.now()}`;

        // Fetch user and order details
        const user = await UserModel.findById(order.customer);
        if (!user) throw new Error('User not found');

        const populatedOrder = await OrderModel.findById(order._id)
            .populate('items.product')
            .populate('customer', 'name email phone');

        if (!populatedOrder || !populatedOrder.items || populatedOrder.items.length === 0) {
            throw new Error('Order not found or has no items');
        }

        // Create a new PDF document
        const doc = new PDFDocument({ margin: 50 });

        // Store PDF data in a buffer
        const pdfBuffer = [];

        doc.on('data', chunk => pdfBuffer.push(chunk));

        // Add invoice details
        doc.fontSize(20).text('INVOICE', { align: 'center' }).moveDown();
        doc.fontSize(12).text(`Invoice Number: ${invoiceNumber}`);
        doc.text(`Date: ${new Date(order.orderDate).toLocaleDateString()}`);
        doc.text(`Order ID: ${order._id}`).moveDown();

        // Customer Information
        doc.fontSize(14).text('Customer Information', { underline: true });
        doc.fontSize(12).text(`Name: ${user.name || 'N/A'}`);
        doc.text(`Email: ${user.email || 'N/A'}`);
        doc.text(`Phone: ${user.phone || 'N/A'}`).moveDown();

        // Delivery Address
        doc.fontSize(14).text('Delivery Address', { underline: true });
        doc.fontSize(12);
        if (order.deliveryAddress) {
            const addr = order.deliveryAddress;
            doc.text(`${addr.street}, ${addr.city}, ${addr.state}, ${addr.zipCode}, ${addr.country}`);
        } else {
            doc.text('No delivery address provided');
        }
        doc.moveDown();

        // Payment Information
        doc.fontSize(14).text('Payment Information', { underline: true });
        doc.fontSize(12).text(`Payment Method: ${order.modeOfPayment || 'N/A'}`);

        let paymentStatus = 'Pending';
        if (order.modeOfPayment === 'Online' && order.paymentDetails) {
            paymentStatus = order.paymentDetails.paymentStatus || 'N/A';
            doc.text(`Payment Status: ${paymentStatus}`);
            if (order.paymentDetails.transactionId) {
                doc.text(`Transaction ID: ${order.paymentDetails.transactionId}`);
            }
        }
        doc.moveDown();

        // Order Items
        doc.fontSize(14).text('Order Items', { underline: true }).moveDown();

        const itemX = 50, qtyX = 300, priceX = 400, amountX = 500;
        doc.fontSize(12).text('Item', itemX).text('Qty', qtyX).text('Price', priceX).text('Amount', amountX);
        doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).stroke();

        let subtotal = 0;
        const invoiceItems = [];

        for (const item of populatedOrder.items) {
            const product = item.product;
            if (!product) continue;

            const price = product.discount === 0 ? product.price : product.discountPrice;
            const amount = price * item.quantity;
            subtotal += amount;

            invoiceItems.push({
                productId: product._id,
                productName: product.name || 'Unknown Product',
                quantity: item.quantity,
                price,
                amount
            });

            doc.text(product.name || 'Unknown', itemX)
                .text(item.quantity.toString(), qtyX)
                .text(`₹${price.toFixed(2)}`, priceX)
                .text(`₹${amount.toFixed(2)}`, amountX);
            doc.moveDown();
        }

        // Subtotal, Delivery Fee, Total
        const deliveryFee = populatedOrder.totalAmount - subtotal;
        doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).stroke().moveDown();
        doc.text('Subtotal:', 350).text(`₹${subtotal.toFixed(2)}`, amountX);
        doc.text('Delivery Fee:', 350).text(`₹${deliveryFee.toFixed(2)}`, amountX);
        doc.fontSize(14).text('Total:', 350).text(`₹${populatedOrder.totalAmount.toFixed(2)}`, amountX).moveDown();

        // Footer
        doc.fontSize(10).text('Thank you for your business!', { align: 'center' });
        doc.text(`Page 1 of 1`, { align: 'center' });

        doc.end();

        return new Promise((resolve, reject) => {
            doc.on('end', async () => {
                try {
                    const invoice = new InvoiceModel({
                        invoiceNumber,
                        orderId: order._id,
                        customerId: order.customer,
                        invoiceDate: new Date(),
                        items: invoiceItems,
                        subtotal,
                        deliveryFee,
                        totalAmount: order.totalAmount,
                        paymentMethod: order.modeOfPayment,
                        paymentStatus,
                        pdfContent: Buffer.concat(pdfBuffer)
                    });

                    await invoice.save();

                    const invoiceUrl = `https://aceone-backend-wcgq.onrender.com/inv/invoices/${invoice._id}`;
                    resolve(invoiceUrl);
                } catch (error) {
                    reject(error);
                }
            });
        });

    } catch (error) {
        console.error("Invoice Generation Error:", error.message);
        throw new Error(`Invoice generation failed: ${error.message}`);
    }
}

module.exports = { generateInvoice };
