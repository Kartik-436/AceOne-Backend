// Code Created & Maintained by Kartik Garg

// Required Routers
const { ownerRouter } = require('./routes/ownerRouter.js');
const { userRouter } = require('./routes/userRouter.js');
const { productRouter } = require('./routes/productRouter.js');

// Required Modules
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');

// Required Configs
const db = require('./configs/Mongoose-Connection.js');

// Required Utilities
const timeoutHandler = require('./middlewares/Timeout-Handler.js');
const sendResponse = require('./utils/Send-Response.js');

// Required Middlewares
const { LogProfileIfCookiePresent } = require('./middlewares/Login-Checker.js');

// Required Environment Variables
require('dotenv').config();

// Debugger
const dbgr = require('debug')('development:app');

// const cors = require("cors");

// Express App
const app = express();

// Basic Middlewares
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(timeoutHandler);
// app.use(cors({
//     origin: "http://localhost:5173",
//     credentials: true
// }));

// Custom Routes
app.use('/owner', ownerRouter);
app.use('/user', userRouter);
app.use('/product', productRouter);

// Home Route
app.get('/', LogProfileIfCookiePresent, (req, res) => {
    sendResponse(res, 200, true, "Showcase of AceOne E-Commerce");
});

// 404 Handler
app.use((req, res) => {
    sendResponse(res, 404, false, "Route not found");
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    sendResponse(res, 500, false, "Something went wrong!");
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    dbgr(`Server is running on port ${PORT}`);
});

// Code Created & Maintained by Kartik Garg