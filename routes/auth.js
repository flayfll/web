const express = require('express');
const router = express.Router();
const User = require('../models/user');
const PointTransaction = require('../models/pointTransaction');

// Halaman Registrasi
router.get('/register', (req, res) => {
    res.render('register', { title: 'Registrasi' });
});

// Proses Registrasi
router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            // Tambahkan flash message error
            return res.redirect('/auth/register');
        }
        const user = new User({ username, email, password });

        // Bonus poin registrasi
        const registrationBonusPoints = 10; // Misal 10 poin
        user.pointsBalance += registrationBonusPoints;

        await user.save();

        // Catat transaksi poin bonus
        await PointTransaction.create({
            user: user._id,
            points: registrationBonusPoints,
            type: 'bonus_registration',
            description: 'Bonus poin registrasi akun baru'
        });

        req.session.user = { _id: user._id, username: user.username, email: user.email, pointsBalance: user.pointsBalance }; // Simpan user di session
        req.session.save(err => {
            if(err) console.error(err);
            const redirectTo = req.session.redirectTo || '/user/profile';
            delete req.session.redirectTo;
            res.redirect(redirectTo);
        });

    } catch (error) {
        console.error(error);
        // Tambahkan flash message error
        res.redirect('/auth/register');
    }
});

// Halaman Login
router.get('/login', (req, res) => {
    res.render('login', { title: 'Login' });
});

// Proses Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user || !(await user.comparePassword(password))) {
            // Tambahkan flash message error
            return res.redirect('/auth/login');
        }
        req.session.user = { _id: user._id, username: user.username, email: user.email, pointsBalance: user.pointsBalance };
         req.session.save(err => {
            if(err) console.error(err);
            const redirectTo = req.session.redirectTo || '/user/profile';
            delete req.session.redirectTo;
            res.redirect(redirectTo);
        });
    } catch (error) {
        console.error(error);
        res.redirect('/auth/login');
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/'); // Handle error
        }
        res.clearCookie('connect.sid'); // Nama cookie default session
        res.redirect('/');
    });
});

module.exports = router;