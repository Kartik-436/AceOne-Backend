async function generateInvoice(order) {
    // Import required modules
    const PDFDocument = require('pdfkit');
    const fs = require('fs');
    const path = require('path');
    const { Readable } = require('stream');

    // Import the Invoice model 
    // (Make sure you've created this model as shown above)
    const InvoiceModel = require('../models/invoice');

    // Create a unique invoice number
    const invoiceNumber = `INV-${order._id.toString().substring(0, 8)}-${Date.now()}`;

    return new Promise(async (resolve, reject) => {
        try {
            // Create a new PDF document
            const doc = new PDFDocument({ margin: 50 });

            // Create a buffer to store the PDF
            const chunks = [];

            // Set up event handlers to capture PDF data
            doc.on('data', chunk => chunks.push(chunk));

            // Populate user and order details
            const user = await UserModel.findById(order.customer);
            if (!user) {
                throw new Error('User not found');
            }

            // Fetch full product details for each item
            const populatedOrder = await OrderModel.findById(order._id)
                .populate('items.product')
                .populate('customer', 'name email phone');

            if (!populatedOrder) {
                throw new Error('Order not found');
            }

            // Add company logo and header
            doc.fontSize(20).text('INVOICE', { align: 'center' });
            doc.moveDown();

            // Add invoice metadata
            doc.fontSize(12);
            doc.text(`Invoice Number: ${invoiceNumber}`);
            doc.text(`Date: ${new Date(order.orderDate).toLocaleDateString()}`);
            doc.text(`Order ID: ${order._id}`);
            doc.moveDown();

            // Add customer information
            doc.fontSize(14).text('Customer Information', { underline: true });
            doc.fontSize(12);
            doc.text(`Name: ${user.name || 'N/A'}`);
            doc.text(`Email: ${user.email || 'N/A'}`);
            doc.text(`Phone: ${user.phone || 'N/A'}`);
            doc.moveDown();

            // Add delivery address
            doc.fontSize(14).text('Delivery Address', { underline: true });
            doc.fontSize(12);
            if (order.deliveryAddress) {
                const addr = order.deliveryAddress;
                const addressText = [
                    addr.street,
                    addr.city,
                    addr.state,
                    addr.zipCode,
                    addr.country
                ].filter(Boolean).join(', ');
                doc.text(addressText);
            } else {
                doc.text('No delivery address provided');
            }
            doc.moveDown();

            // Add payment information
            doc.fontSize(14).text('Payment Information', { underline: true });
            doc.fontSize(12);
            doc.text(`Payment Method: ${order.modeOfPayment}`);

            let paymentStatus = 'Pending';
            if (order.modeOfPayment === 'Online' && order.paymentDetails) {
                paymentStatus = order.paymentDetails.paymentStatus;
                doc.text(`Payment Status: ${paymentStatus}`);

                if (order.paymentDetails.paymentMethod === 'card' && order.paymentDetails.cardDetails) {
                    doc.text(`Card: ${order.paymentDetails.cardDetails.brand.toUpperCase()} ending in ${order.paymentDetails.cardDetails.last4}`);
                } else if (order.paymentDetails.paymentMethod === 'upi' && order.paymentDetails.upiDetails) {
                    doc.text(`UPI: ${order.paymentDetails.upiDetails.vpa}`);
                }

                if (order.paymentDetails.transactionId) {
                    doc.text(`Transaction ID: ${order.paymentDetails.transactionId}`);
                }
            }
            doc.moveDown();

            // Add order items table
            doc.fontSize(14).text('Order Items', { underline: true });
            doc.moveDown();

            // Define table structure
            const tableTop = doc.y;
            const itemX = 50;
            const quantityX = 300;
            const priceX = 400;
            const amountX = 500;

            // Add table headers
            doc.fontSize(12);
            doc.text('Item', itemX, tableTop);
            doc.text('Qty', quantityX, tableTop);
            doc.text('Price', priceX, tableTop);
            doc.text('Amount', amountX, tableTop);

            // Draw header line
            doc.moveTo(50, tableTop + 20)
                .lineTo(550, tableTop + 20)
                .stroke();

            // Initialize table position
            let tableRow = tableTop + 30;

            // Prepare items array for MongoDB storage
            const invoiceItems = [];

            // Add items
            for (const item of populatedOrder.items) {
                const product = item.product;
                if (!product) continue;

                const price = product.discount === 0 ? product.price : product.discountPrice;
                const amount = price * item.quantity;

                // Add to invoice items array for MongoDB
                invoiceItems.push({
                    productId: product._id,
                    productName: product.name || 'Unknown Product',
                    quantity: item.quantity,
                    price: price,
                    amount: amount
                });

                // Check if we need a new page
                if (tableRow > 700) {
                    doc.addPage();
                    tableRow = 50;
                }

                doc.text(product.name || 'Unknown Product', itemX, tableRow);
                doc.text(item.quantity.toString(), quantityX, tableRow);
                doc.text(`₹${price.toFixed(2)}`, priceX, tableRow);
                doc.text(`₹${amount.toFixed(2)}`, amountX, tableRow);

                tableRow += 20;
            }

            // Draw footer line
            doc.moveTo(50, tableRow)
                .lineTo(550, tableRow)
                .stroke();

            tableRow += 20;

            // Add subtotal, delivery fee and total
            const subtotal = populatedOrder.items.reduce((sum, item) => {
                const product = item.product;
                if (!product) return sum;
                const price = product.discount === 0 ? product.price : product.discountPrice;
                return sum + (price * item.quantity);
            }, 0);

            const deliveryFee = populatedOrder.totalAmount - subtotal;

            doc.text('Subtotal:', 350, tableRow);
            doc.text(`₹${subtotal.toFixed(2)}`, amountX, tableRow);
            tableRow += 20;

            doc.text('Delivery Fee:', 350, tableRow);
            doc.text(`₹${deliveryFee.toFixed(2)}`, amountX, tableRow);
            tableRow += 20;

            doc.fontSize(14);
            doc.text('Total:', 350, tableRow);
            doc.text(`₹${populatedOrder.totalAmount.toFixed(2)}`, amountX, tableRow);

            // Add footer
            const pageCount = doc.bufferedPageRange().count;
            for (let i = 0; i < pageCount; i++) {
                doc.switchToPage(i);

                // Go to the bottom of the page
                doc.page.margins.bottom = 50;
                const pageBottom = doc.page.height - doc.page.margins.bottom;

                doc.fontSize(10)
                    .text('Thank you for your business!',
                        doc.page.margins.left,
                        pageBottom - 40,
                        { align: 'center', width: doc.page.width - doc.page.margins.left - doc.page.margins.right });

                doc.text(`Page ${i + 1} of ${pageCount}`,
                    doc.page.margins.left,
                    pageBottom - 20,
                    { align: 'center', width: doc.page.width - doc.page.margins.left - doc.page.margins.right });
            }

            // Finalize the PDF
            doc.end();

            // When PDF generation is complete
            doc.on('end', async () => {
                try {
                    // Create a Buffer from the chunks
                    const pdfBuffer = Buffer.concat(chunks);

                    // Create a new invoice record in MongoDB
                    const invoice = new InvoiceModel({
                        invoiceNumber: invoiceNumber,
                        orderId: order._id,
                        customerId: order.customer,
                        invoiceDate: new Date(),
                        items: invoiceItems,
                        subtotal: subtotal,
                        deliveryFee: deliveryFee,
                        totalAmount: order.totalAmount,
                        paymentMethod: order.modeOfPayment,
                        paymentStatus: paymentStatus,
                        pdfContent: pdfBuffer
                    });

                    // Save the invoice to MongoDB
                    await invoice.save();

                    // Return the URL to access the invoice
                    // This URL will point to an endpoint that retrieves and serves the PDF from MongoDB
                    const invoiceUrl = `/api/invoices/${invoice._id}`;

                    resolve(invoiceUrl);
                } catch (error) {
                    reject(error);
                }
            });

        } catch (error) {
            reject(error);
        }
    });
}

module.exports = { generateInvoice };