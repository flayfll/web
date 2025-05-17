const express = require('express');
const router = express.Router();
const Product = require('../models/product');
router.post('/add/:productId', async (req, res) => {
    const productId = req.params.productId;
    const quantity = parseInt(req.body.quantity) || 1;

    try {
        const product = await Product.findById(productId);
        if (!product) {
            // Handle product not found
            return res.redirect('/');
        }

        if (!req.session.cart) {
            req.session.cart = [];
        }

        const cartItemIndex = req.session.cart.findIndex(item => item.productId === productId);

        if (cartItemIndex > -1) {
            req.session.cart[cartItemIndex].quantity += quantity;
        } else {
            req.session.cart.push({
                productId: product._id,
                name: product.name,
                price: product.price,
                imageUrl: product.imageUrl,
                quantity: quantity,
                pointsEarnedPerItem: product.pointsEarned
            });
        }
        req.session.save(err => {
            if (err) {
                console.error("Session save error:", err);
                // Handle error
            }
            res.redirect('/cart');
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error menambah ke keranjang");
    }
});

// Lihat Keranjang
router.get('/', (req, res) => {
    const cart = req.session.cart || [];
    let subtotal = 0;
    cart.forEach(item => {
        subtotal += item.price * item.quantity;
    });
    res.render('cart', { title: 'Keranjang Belanja', cart, subtotal });
});

// Hapus item dari keranjang
router.post('/remove/:productId', (req, res) => {
    const productId = req.params.productId;
    if (req.session.cart) {
        req.session.cart = req.session.cart.filter(item => item.productId.toString() !== productId);
        req.session.save(err => {
            if (err) console.error("Session save error:", err);
            res.redirect('/cart');
        });
    } else {
        res.redirect('/cart');
    }
});

// Update kuantitas
router.post('/update/:productId', (req, res) => {
    const productId = req.params.productId;
    const quantity = parseInt(req.body.quantity);

    if (req.session.cart && quantity > 0) {
        const itemIndex = req.session.cart.findIndex(item => item.productId.toString() === productId);
        if (itemIndex > -1) {
            req.session.cart[itemIndex].quantity = quantity;
        }
        req.session.save(err => {
            if (err) console.error("Session save error:", err);
            res.redirect('/cart');
        });
    } else if (quantity <= 0) {
        // if quantity is 0 or less, remove item
        if (req.session.cart) {
            req.session.cart = req.session.cart.filter(item => item.productId.toString() !== productId);
            req.session.save(err => {
                if (err) console.error("Session save error:", err);
                res.redirect('/cart');
            });
        }
    }
    else {
        res.redirect('/cart');
    }
});


module.exports = router;