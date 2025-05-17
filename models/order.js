const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const orderItemSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1 },
    priceAtPurchase: { type: Number, required: true }, // Harga saat dibeli
    pointsEarnedPerItem: { type: Number, default: 0}
}, { _id: false });

const orderSchema = new mongoose.Schema({
    merchantOrderId: { type: String, default: () => `TOKOKU-${uuidv4()}`, unique: true }, // ID unik untuk DANA
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [orderItemSchema],
    totalAmount: { type: Number, required: true },
    totalPointsEarned: { type: Number, default: 0 },
    shippingAddress: { type: String, required: true }, // Sederhana dulu
    status: {
        type: String,
        enum: ['pending_payment', 'paid', 'processing', 'shipped', 'completed', 'cancelled', 'failed'],
        default: 'pending_payment'
    },
    paymentMethod: { type: String, enum: ['dana', 'cod'], default: 'dana' },
    danaTransactionId: { type: String }, // ID dari DANA setelah payment
    danaRedirectUrl: { type: String },   // URL redirect ke DANA
    createdAt: { type: Date, default: Date.now },
    paidAt: { type: Date }
});

module.exports = mongoose.model('Order', orderSchema);