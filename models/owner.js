const mongoose = require('mongoose');

const ownerSchema = new mongoose.Schema({
    fullName: {
        type: String,
    },
    email: {
        type: String,
        unique: true
    },
    password: {
        type: String,
    },
    products: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    }],
    contact: {
        type: String,
    },
    dateOfBirth: {
        type: Date,
    },
    picture: {
        data: {
            type: Buffer,
        },
        contentType: {
            type: String,
        }
    },
    gstNo: {
        type: String,
    }
}, {
    timestamps: true
});

const ownerModel = mongoose.model('Owner', ownerSchema);

module.exports = ownerModel;