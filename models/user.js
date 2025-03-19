const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    fullName: {
        type: String,
        trim: true
    },
    email: {
        type: String,
        unique: true,
        trim: true
    },
    password: {
        type: String,
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationToken: {
        type: String
    },
    verificationTokenExpires: {
        type: Date
    },
    cart: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    }],
    orders: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
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
    address: {
        type: String,
        default: "",
    },
    wishlist: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Wish'
    }]
}, {
    timestamps: true
});

const UserModel = mongoose.model('User', userSchema);

module.exports = UserModel;