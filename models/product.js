const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    imageUrl: { type: String, default: 'https://via.placeholder.com/300x200/100F24/F0F0F5?text=Produk+Digital' },
    thumbnailUrl: { type: String, default: 'https://via.placeholder.com/400x250/100F24/F0F0F5?text=Sampul+Produk' }, // Tambahan untuk sampul
    brand: { type: String, trim: true }, // Tambahan untuk merk
    stock: { type: Number, default: 1, min: 0 }, // Asumsi produk digital bisa banyak, atau fisik
    pointsEarned: { type: Number, default: 0 },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // WAJIB: Siapa penjualnya
    tags: [String], // Opsional: untuk kategori/pencarian
    isPublished: { type: Boolean, default: true }, // Untuk penjual bisa draft/publish
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

productSchema.pre('save', function(next) {
    if (this.isModified('price') || this.isNew) {
        this.pointsEarned = Math.floor(this.price / 10000); // Aturan poin tetap sama
    }
    this.updatedAt = Date.now();
    next();
});

productSchema.index({ name: 'text', description: 'text', brand: 'text', tags: 'text' }); // Untuk fitur search

module.exports = mongoose.model('Product', productSchema);