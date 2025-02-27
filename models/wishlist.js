const mongoose = require('mongoose');

const wishSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Owner',
    }
});

const wishModel = mongoose.model('Wish', wishSchema);
module.exports = wishModel;
