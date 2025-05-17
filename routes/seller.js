const express = require('express');
const router = express.Router();
const Product = require('../models/product');
const User = require('../models/user'); // Jika perlu ambil info seller

function isLoggedIn(req, res, next) {
    if (req.session.user) {
        return next();
    }
    req.session.redirectTo = req.originalUrl;
    res.redirect('/auth/login');
}

router.get('/dashboard', isLoggedIn, async (req, res) => {
    try {
        const sellerProducts = await Product.find({ seller: req.session.user._id }).sort({ createdAt: -1 });
        const sellerUser = await User.findById(req.session.user._id); // Ambil info user terbaru
        res.render('seller/dashboard', {
            title: 'Dashboard Penjual',
            products: sellerProducts,
            seller: sellerUser
        });
    } catch (error) {
        console.error("Error fetching seller dashboard:", error);
        res.status(500).render('error-page', { title: "Error", message: "Gagal memuat dashboard."});
    }
});

router.get('/products/add', isLoggedIn, (req, res) => {
    res.render('seller/add-product', {
        title: 'Tambah Produk Baru',
        product: {} // Untuk form EJS yang sama dengan edit
    });
});

router.post('/products/add', isLoggedIn, async (req, res) => {
    try {
        const { name, description, price, stock, brand, thumbnailUrl, imageUrl, tags, isPublished } = req.body;
        const newProduct = new Product({
            name,
            description,
            price: parseFloat(price),
            stock: parseInt(stock) || 0,
            brand,
            thumbnailUrl,
            imageUrl,
            tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
            isPublished: isPublished === 'on', // Checkbox value
            seller: req.session.user._id
        });
        await newProduct.save();
        // Tambahkan flash message sukses
        res.redirect('/seller/dashboard');
    } catch (error) {
        console.error("Error adding product:", error);
        // Tambahkan flash message error
        res.status(400).render('seller/add-product', {
            title: 'Tambah Produk Baru',
            product: req.body, // Kirim kembali data yang diinput
            errorMessage: 'Gagal menambahkan produk. Pastikan semua field terisi dengan benar.'
        });
    }
});

router.get('/products/edit/:productId', isLoggedIn, async (req, res) => {
    try {
        const product = await Product.findOne({ _id: req.params.productId, seller: req.session.user._id });
        if (!product) {
            // Tambahkan flash message
            return res.redirect('/seller/dashboard');
        }
        res.render('seller/edit-product', {
            title: 'Edit Produk',
            product: product
        });
    } catch (error) {
        console.error("Error fetching product for edit:", error);
        res.redirect('/seller/dashboard');
    }
});

router.post('/products/edit/:productId', isLoggedIn, async (req, res) => {
    try {
        const { name, description, price, stock, brand, thumbnailUrl, imageUrl, tags, isPublished } = req.body;
        const product = await Product.findOne({ _id: req.params.productId, seller: req.session.user._id });

        if (!product) {
            return res.status(404).send('Produk tidak ditemukan atau Anda tidak berhak mengubahnya.');
        }

        product.name = name;
        product.description = description;
        product.price = parseFloat(price);
        product.stock = parseInt(stock) || 0;
        product.brand = brand;
        product.thumbnailUrl = thumbnailUrl;
        product.imageUrl = imageUrl;
        product.tags = tags ? tags.split(',').map(tag => tag.trim()) : [];
        product.isPublished = isPublished === 'on';

        await product.save();
        // Tambahkan flash message sukses
        res.redirect('/seller/dashboard');
    } catch (error) {
        console.error("Error updating product:", error);
        // Tambahkan flash message error
        const productData = await Product.findById(req.params.productId); // Re-fetch for form
        res.status(400).render('seller/edit-product', {
            title: 'Edit Produk',
            product: { ...productData.toObject(), ...req.body }, // Merge, prioritize req.body on error
            errorMessage: 'Gagal memperbarui produk. Pastikan semua field terisi dengan benar.'
        });
    }
});

router.post('/products/delete/:productId', isLoggedIn, async (req, res) => {
    try {
        const result = await Product.deleteOne({ _id: req.params.productId, seller: req.session.user._id });
        if (result.deletedCount === 0) {
            // Tambahkan flash message: produk tidak ditemukan atau bukan milik Anda
        } else {
            // Tambahkan flash message: produk berhasil dihapus
        }
        res.redirect('/seller/dashboard');
    } catch (error) {
        console.error("Error deleting product:", error);
        // Tambahkan flash message error
        res.redirect('/seller/dashboard');
    }
});

module.exports = router;