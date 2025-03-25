const express = require('express');
const router = express.Router();
const InvoiceModel = require('../models/invoice');
const OrderModel = require('../models/order');
const { authenticateUser } = require('../middlewares/Login-Checker');

router.get('/invoices/:id', authenticateUser, async (req, res) => {
    try {
        const invoiceId = req.params.id;
        const invoice = await InvoiceModel.findById(invoiceId);

        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: "Invoice not found"
            });
        }

        // Check if user is authenticateUserorized to view this invoice
        const order = await OrderModel.findById(invoice.orderId);
        if (!order || order.customer.toString() !== req.user.ID.toString()) {
            return res.status(403).json({
                success: false,
                message: "UnauthenticateUserorized access to invoice"
            });
        }

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${invoice.invoiceNumber}.pdf"`);

        // Send the PDF data
        res.send(invoice.pdfContent);

    } catch (err) {
        console.error("Get Invoice Error:", err.message);
        return res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
});

// Get all invoices for current user
router.get('/user/invoices', authenticateUser, async (req, res) => {
    try {
        const invoices = await InvoiceModel.find({ customerId: req.user.ID })
            .select('-pdfContent') // Exclude the PDF data to reduce response size
            .sort({ invoiceDate: -1 });

        return res.status(200).json({
            success: true,
            message: "User invoices fetched successfully",
            data: invoices
        });
    } catch (err) {
        console.error("Get User Invoices Error:", err.message);
        return res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
});

// Get invoice by order ID
router.get('/orders/:orderId/invoice', authenticateUser, async (req, res) => {
    try {
        const orderId = req.params.orderId;

        // Check if user is authenticateUserorized to view this order
        const order = await OrderModel.findById(orderId);
        if (!order || order.customer.toString() !== req.user.ID.toString()) {
            return res.status(403).json({
                success: false,
                message: "UnauthenticateUserorized access to order invoice"
            });
        }

        const invoice = await InvoiceModel.findOne({ orderId }).select('-pdfContent');

        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: "Invoice not found for this order"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Invoice details fetched successfully",
            data: {
                ...invoice.toObject(),
                downloadUrl: `https://aceone-backend.up.railway.app/inv/invoices/${invoice._id}`
            }
        });

    } catch (err) {
        console.error("Get Order Invoice Error:", err.message);
        return res.status(500).json({
            success: false,
            message: "Something went wrong"
        });
    }
});

module.exports.invoiceRouter = router;
