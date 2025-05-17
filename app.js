require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');

const app = express();

// Middlewares
app.use(express.json()); // Untuk parsing application/json (penting untuk DANA notify)
app.use(express.urlencoded({ extended: true })); // Untuk parsing application/x-www-form-urlencoded
app.use(express.static(path.join(__dirname, 'public')));

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 hari
}));

// Middleware untuk user & cart di semua view
app.use((req, res, next) => {
    res.locals.currentUser = req.session.user;
    res.locals.cart = req.session.cart || [];
    res.locals.getCartTotal = () => {
        return (req.session.cart || []).reduce((sum, item) => sum + item.price * item.quantity, 0);
    };
    res.locals.getCartItemCount = () => {
        return (req.session.cart || []).reduce((sum, item) => sum + item.quantity, 0);
    };
    next();
});

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error('MongoDB Connection Error:', err));
const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/auth');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/order');
const userRoutes = require('./routes/user');
const sellerRoutes = require('./routes/seller');

app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/cart', cartRoutes);
app.use('/order', orderRoutes);
app.use('/user', userRoutes);
app.use('/seller', sellerRoutes);
app.use((err, req, res, next) => {
    console.error("Global Error Handler:", err.stack);
    res.status(500).send('Ada yang salah nih, Bang!');
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server jalan di port ${PORT}`);
    console.log(`Cek DANA Notify URL: ${process.env.APP_BASE_URL}/order/dana/notify`);
    console.log(`Cek DANA Redirect URL: ${process.env.APP_BASE_URL}/order/dana/finish`);
});