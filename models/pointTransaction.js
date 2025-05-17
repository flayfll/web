const mongoose = require('mongoose');
const pointTransactionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' }, // Opsional, jika terkait order
    points: { type: Number, required: true }, // Positif untuk earned, negatif untuk redeemed
    type: { type: String, enum: ['earn_purchase', 'redeem_discount', 'bonus_registration'], required: true },
    description: { type: String },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PointTransaction', pointTransactionSchema);