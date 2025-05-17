const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Order = require('../models/order');
const PointTransaction = require('../models/pointTransaction');

// Middleware: Cek apakah user sudah login
function isLoggedIn(req, res, next) {
    if (req.session.user) {
        return next();
    }
    res.redirect('/auth/login');
}

// Halaman Profil Pengguna
router.get('/profile', isLoggedIn, async (req, res) => {
    try {
        // Ambil data user terbaru, terutama pointsBalance
        const user = await User.findById(req.session.user._id);
        if (!user) {
            // Handle jika user tidak ditemukan (seharusnya tidak terjadi jika session valid)
            req.session.destroy();
            return res.redirect('/auth/login');
        }
        // Update session user
        req.session.user.pointsBalance = user.pointsBalance;


        const orders = await Order.find({ user: user._id }).sort({ createdAt: -1 });
        const pointHistory = await PointTransaction.find({ user: user._id }).sort({ createdAt: -1 });

        res.render('profile', {
            title: 'Profil Saya',
            user: user, // Kirim objek user lengkap
            orders: orders,
            pointHistory: pointHistory
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error mengambil data profil");
    }
});

// Halaman Redeem Poin (Contoh Sederhana)
// Di dunia nyata, ini bisa jadi lebih kompleks, misal redeem jadi voucher, produk, dll.
// Untuk sekarang, kita bisa tampilkan saja histori poin.
// Fungsi redeem sebenarnya bisa diintegrasikan di halaman checkout (potong total belanja).

module.exports = router;