const ProductModel = require('../models/product.js');
const UserModel = require('../models/user.js');
const OrderModel = require('../models/order.js');
const InvoiceModel = require('../models/invoice.js');
const PDFDocument = require('pdfkit');

async function generateInvoice(order) {
    try {
        if (!order || !order._id) {
            throw new Error('Invalid order data received');
        }

        console.log("Generating invoice for Order ID:", order._id);

        // Validate and fetch customer details
        if (!order.customer) {
            throw new Error(`Order missing customer ID: ${order._id}`);
        }

        const user = await UserModel.findById(order.customer);
        if (!user) {
            throw new Error(`User not found for ID: ${order.customer}`);
        }

        console.log("Customer found:", user.name, user.email);

        // Fetch full order details
        const populatedOrder = await OrderModel.findById(order._id)
            .populate('items.product')
            .populate('customer');

        if (!populatedOrder) {
            throw new Error(`Order not found in database: ${order._id}`);
        }

        console.log("Order populated successfully");

        // Generate a unique invoice number
        const invoiceNumber = `INV-${order._id.toString().substring(0, 8)}-${Date.now()}`;

        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 50 });
                const chunks = [];

                doc.on('data', chunk => chunks.push(chunk));

                // Generate invoice content
                doc.fontSize(20).text('INVOICE', { align: 'center' }).moveDown();
                doc.fontSize(12).text(`Invoice Number: ${invoiceNumber}`);
                doc.text(`Date: ${new Date().toLocaleDateString()}`);
                doc.text(`Order ID: ${order._id}`).moveDown();

                // Customer details
                doc.fontSize(14).text('Customer Information', { underline: true });
                doc.fontSize(12).text(`Name: ${user.name || 'N/A'}`);
                doc.text(`Email: ${user.email || 'N/A'}`);
                doc.text(`Phone: ${user.phone || 'N/A'}`).moveDown();

                // Order items table
                doc.fontSize(14).text('Order Items', { underline: true }).moveDown();
                const tableTop = doc.y;
                const itemX = 50, quantityX = 300, priceX = 400, amountX = 500;

                doc.fontSize(12);
                doc.text('Item', itemX, tableTop);
                doc.text('Qty', quantityX, tableTop);
                doc.text('Price', priceX, tableTop);
                doc.text('Amount', amountX, tableTop);

                doc.moveTo(50, tableTop + 20).lineTo(550, tableTop + 20).stroke();

                let tableRow = tableTop + 30;
                let invoiceItems = [];

                for (const item of populatedOrder.items) {
                    const product = item.product;
                    if (!product) continue;

                    const price = product.discount === 0 ? product.price : product.discountPrice;
                    const amount = price * item.quantity;

                    invoiceItems.push({
                        productId: product._id,
                        productName: product.name || 'Unknown Product',
                        quantity: item.quantity,
                        price: price,
                        amount: amount
                    });

                    doc.text(product.name || 'Unknown Product', itemX, tableRow);
                    doc.text(item.quantity.toString(), quantityX, tableRow);
                    doc.text(`₹${price.toFixed(2)}`, priceX, tableRow);
                    doc.text(`₹${amount.toFixed(2)}`, amountX, tableRow);

                    tableRow += 20;
                }

                doc.moveTo(50, tableRow).lineTo(550, tableRow).stroke();
                tableRow += 20;

                // Subtotal & Total
                const subtotal = invoiceItems.reduce((sum, item) => sum + item.amount, 0);
                const deliveryFee = populatedOrder.totalAmount - subtotal;

                doc.text('Subtotal:', 350, tableRow);
                doc.text(`₹${subtotal.toFixed(2)}`, amountX, tableRow);
                tableRow += 20;

                doc.text('Delivery Fee:', 350, tableRow);
                doc.text(`₹${deliveryFee.toFixed(2)}`, amountX, tableRow);
                tableRow += 20;

                doc.fontSize(14).text('Total:', 350, tableRow);
                doc.text(`₹${populatedOrder.totalAmount.toFixed(2)}`, amountX, tableRow);

                doc.end();

                doc.on('end', async () => {
                    try {
                        const pdfBuffer = Buffer.concat(chunks);

                        // Save invoice in MongoDB
                        const invoice = new InvoiceModel({
                            invoiceNumber,
                            orderId: order._id,
                            customerId: order.customer,
                            invoiceDate: new Date(),
                            items: invoiceItems,
                            subtotal,
                            deliveryFee,
                            totalAmount: order.totalAmount,
                            pdfContent: pdfBuffer
                        });

                        await invoice.save();
                        const invoiceUrl = `https://aceone-backend-wcgq.onrender.com/inv/invoices/${invoice._id}`;
                        console.log("Invoice generated successfully:", invoiceUrl);
                        resolve(invoiceUrl);
                    } catch (error) {
                        console.error("Error saving invoice:", error);
                        reject(error);
                    }
                });

            } catch (error) {
                console.error("Error during invoice generation:", error);
                reject(error);
            }
        });

    } catch (error) {
        console.error("Invoice Generation Error:", error.message);
        throw new Error(`Invoice generation failed: ${error.message}`);
    }
}

module.exports = { generateInvoice };
