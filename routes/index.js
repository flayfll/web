const express = require('express');
const router = express.Router();
const Product = require('../models/product');
const User = require('../models/user');

router.get('/', async (req, res) => {
    try {
        const products = await Product.find({ isPublished: true })
                                      .populate('seller', 'username storeName _id')
                                      .sort({ createdAt: -1 })
                                      .limit(12); // Example: limit products on homepage
        res.render('index', { title: 'Selamat Datang di TokoKeren!', products });
    } catch (error) {
        console.error("Error fetching homepage products:", error);
        res.status(500).render('error-page', { title: "Server Error", message: "Gagal memuat produk. Silakan coba lagi nanti."});
    }
});

router.get('/product/:id', async (req, res) => {
    try {
        const product = await Product.findOne({ _id: req.params.id, isPublished: true })
                                     .populate('seller', 'username storeName _id');
        if (!product) {
            return res.status(404).render('error-page', { title: "Produk Tidak Ditemukan", message: "Maaf, produk yang Anda cari tidak ditemukan atau belum dipublikasikan."});
        }
        res.render('product-detail', { title: product.name, product });
    } catch (error) {
        console.error("Error fetching product detail:", error);
        if (error.kind === 'ObjectId') {
             return res.status(404).render('error-page', { title: "Format ID Salah", message: "Format ID produk yang Anda masukkan tidak valid."});
        }
        res.status(500).render('error-page', { title: "Server Error", message: "Gagal memuat detail produk. Silakan coba lagi nanti."});
    }
});

router.get('/store/:sellerId', async (req, res) => {
    try {
        const seller = await User.findById(req.params.sellerId).select('username storeName createdAt');
        if (!seller) {
            return res.status(404).render('error-page', { title: "Penjual Tidak Ditemukan", message: "Maaf, penjual yang Anda cari tidak ditemukan."});
        }
        const products = await Product.find({ seller: req.params.sellerId, isPublished: true })
                                      .sort({ createdAt: -1 });
        res.render('store-profile', {
            title: `Toko ${seller.storeName || seller.username}`,
            seller,
            products
        });
    } catch (error) {
        console.error("Error fetching store profile:", error);
         if (error.kind === 'ObjectId') {
             return res.status(404).render('error-page', { title: "Format ID Salah", message: "Format ID penjual yang Anda masukkan tidak valid."});
        }
        res.status(500).render('error-page', { title: "Server Error", message: "Gagal memuat halaman toko. Silakan coba lagi nanti."});
    }
});

module.exports = router;