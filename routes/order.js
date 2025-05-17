const express = require('express');
const router = express.Router();
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const Order = require('../models/order');
const User = require('../models/user');
const PointTransaction = require('../models/pointTransaction');
const Product = require('../models/product');
const danaConfig = require('../config/dana');
const { generateDanaSnapSignature, verifyDanaSnapSignature } = require('../utils/danaSnapSignature');

function isLoggedIn(req, res, next) {
    if (req.session.user) {
        return next();
    }
    req.session.returnTo = req.originalUrl;
    res.redirect('/auth/login');
}

router.get('/checkout', isLoggedIn, (req, res) => {
    if (!req.session.cart || req.session.cart.length === 0) {
        console.log('Checkout attempt with empty cart');
        // req.flash('error_msg', 'Keranjang Anda kosong.'); // Jika pakai connect-flash
        return res.redirect('/cart');
    }
    const cartTotal = res.locals.getCartTotal();
    res.render('checkout', {
        title: 'Checkout Pesanan',
        totalAmount: cartTotal,
        // errorMessage: req.flash('error_msg') // Jika pakai connect-flash
    });
});

router.post('/checkout/process', isLoggedIn, async (req, res) => {
    if (!req.session.cart || req.session.cart.length === 0) {
        return res.redirect('/cart');
    }

    const { shippingAddress } = req.body;
    if (!shippingAddress || shippingAddress.trim() === "") {
        return res.render('checkout', {
            title: 'Checkout Pesanan',
            totalAmount: res.locals.getCartTotal(),
            errorMessage: 'Alamat pengiriman tidak boleh kosong.'
        });
    }

    const cart = req.session.cart;
    const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const totalPointsEarned = cart.reduce((sum, item) => sum + (item.pointsEarnedPerItem || 0) * item.quantity, 0);

    const orderItems = cart.map(item => ({
        product: item.productId,
        quantity: item.quantity,
        priceAtPurchase: item.price,
        pointsEarnedPerItem: item.pointsEarnedPerItem || 0
    }));

    let newOrder;

    try {
        newOrder = new Order({
            user: req.session.user._id,
            items: orderItems,
            totalAmount: totalAmount,
            totalPointsEarned: totalPointsEarned,
            shippingAddress: shippingAddress,
            status: 'pending_payment',
            paymentMethod: 'dana_snap',
        });
        const savedOrder = await newOrder.save();
        const timestamp = new Date().toISOString();

        const snapEndpointPath = "/snap/v1.0/payment-request"; // PLACEHOLDER - GANTI DENGAN ENDPOINT DANA SNAP!

        const snapRequestBody = { // PLACEHOLDER - SESUAIKAN DENGAN DOKUMENTASI DANA SNAP!
            partnerReferenceNo: savedOrder.merchantOrderId,
            merchantId: danaConfig.merchantId,
            amount: {
                value: savedOrder.totalAmount.toFixed(2),
                currency: "IDR"
            },
            additionalInfo: {
                customerName: req.session.user.username,
                items: savedOrder.items.map(item => ({ name: `Produk-${item.product.toString().substring(0,5)}`, quantity: item.quantity, price: item.priceAtPurchase.toFixed(2) })), // Ambil nama produk dari DB jika perlu
                callbackUrl: danaConfig.paymentNotifyUrl, // Untuk Notifikasi
                // redirectUrl: danaConfig.paymentRedirectUrl, // Untuk halaman finish
            }
        };
        const requestBodyString = JSON.stringify(snapRequestBody);

        const signature = generateDanaSnapSignature( // Pastikan fungsi ini diimplementasikan dengan benar
            "POST",
            snapEndpointPath,
            requestBodyString,
            timestamp,
            danaConfig.clientId,
            danaConfig.privateKey
        );

        const snapHeaders = { // PLACEHOLDER - SESUAIKAN HEADERS DANA SNAP!
            'Content-Type': 'application/json',
            'X-TIMESTAMP': timestamp,
            'X-CLIENT-KEY': danaConfig.clientId,
            'X-SIGNATURE': signature, // Cek format prefix jika ada (misal, 'HMACSHA256=')
            'X-EXTERNAL-ID': savedOrder.merchantOrderId, // Mungkin diperlukan oleh DANA SNAP
        };

        console.log("Sending to DANA SNAP:", danaConfig.apiBaseUrl + snapEndpointPath);
        console.log("DANA SNAP Request Body:", requestBodyString);
        console.log("DANA SNAP Headers:", snapHeaders);

        const danaSnapResponse = await axios.post(
            danaConfig.apiBaseUrl + snapEndpointPath,
            snapRequestBody,
            { headers: snapHeaders }
        );

        console.log('DANA SNAP Raw Response Data:', JSON.stringify(danaSnapResponse.data, null, 2));

        if (danaSnapResponse.data && (danaSnapResponse.data.redirectUrl || danaSnapResponse.data.virtualAccountNo || danaSnapResponse.data.actions)) {
            if (danaSnapResponse.data.redirectUrl) {
                savedOrder.danaTransactionId = danaSnapResponse.data.transactionId || danaSnapResponse.data.referenceNo || savedOrder.merchantOrderId;
                savedOrder.danaRedirectUrl = danaSnapResponse.data.redirectUrl;
                await savedOrder.save();
                req.session.cart = [];
                await req.session.save();
                return res.redirect(danaSnapResponse.data.redirectUrl);
            } else if (danaSnapResponse.data.virtualAccountNo || (danaSnapResponse.data.actions && danaSnapResponse.data.actions.some(a => a.name === 'QR_CODE_DISPLAY'))) {
                savedOrder.danaTransactionId = danaSnapResponse.data.transactionId || danaSnapResponse.data.referenceNo || savedOrder.merchantOrderId;
                // Simpan info VA atau QRIS jika perlu, atau flag bahwa ini tipe pembayaran tsb
                await savedOrder.save();
                req.session.cart = [];
                await req.session.save();
                return res.render('show-payment-details', { // Buat view ini jika perlu
                    title: 'Selesaikan Pembayaran',
                    order: savedOrder.toObject(),
                    paymentData: danaSnapResponse.data, // Kirim semua data respons SNAP
                    message: "Silakan selesaikan pembayaran Anda menggunakan detail berikut."
                });
            } else {
                console.error('DANA SNAP Response format not yet handled:', danaSnapResponse.data);
                throw new Error('Format respons DANA SNAP tidak dikenali untuk alur pembayaran.');
            }
        } else {
            const responseCode = danaSnapResponse.data?.responseCode || 'N/A';
            const responseMessage = danaSnapResponse.data?.responseMessage || 'Format respons dari DANA SNAP tidak sesuai.';
            console.error(`DANA SNAP Response format unexpected (Code: ${responseCode}):`, danaSnapResponse.data);
            throw new Error(`Pembayaran Gagal (DANA SNAP): ${responseMessage} (Code: ${responseCode})`);
        }

    } catch (error) {
        let message = "Terjadi kesalahan internal saat memproses pembayaran. Silakan coba lagi nanti.";
        console.error('--- ERROR START: Proses Checkout DANA SNAP ---');
        if (error.response) {
            console.error('DANA SNAP Error Response Data:', JSON.stringify(error.response.data, null, 2));
            console.error('DANA SNAP Error Response Status:', error.response.status);
            console.error('DANA SNAP Error Response Headers:', JSON.stringify(error.response.headers, null, 2));
            const danaErrorMsg = error.response.data?.responseMessage || error.response.data?.message || error.response.statusText;
            message = `Error dari DANA (${error.response.status}): ${danaErrorMsg || 'Tidak ada pesan spesifik'}`;
        } else if (error.request) {
            console.error('DANA SNAP Error Request (No Response): Error making request. Error: ', error.message);
            message = "Tidak ada respons dari server DANA. Cek koneksi Anda atau endpoint DANA mungkin sedang bermasalah.";
        } else {
            console.error('Axios/Setup Error Message:', error.message);
            message = `Kesalahan sistem: ${error.message}`;
        }
        if (error.message.startsWith('DANA SNAP Signature Generation Failed') || error.message.startsWith('Pembayaran Gagal (DANA SNAP)')) {
            message = error.message;
        }
        console.error('Full Error Object (if available):', error.toJSON ? JSON.stringify(error.toJSON(), null, 2) : error);
        console.error('--- ERROR END: Proses Checkout DANA SNAP ---');

        if (newOrder && newOrder._id && newOrder.status === 'pending_payment') {
            try {
                await Order.findByIdAndUpdate(newOrder._id, { status: 'failed', $unset: { danaRedirectUrl: "", danaTransactionId: "" } });
                console.log(`Order ${newOrder.merchantOrderId} status updated to FAILED due to DANA SNAP processing error.`);
            } catch (updateError) {
                console.error(`Failed to update order ${newOrder.merchantOrderId} status to FAILED:`, updateError);
            }
        }
        res.render('order-failed', {
            title: "Pembayaran Gagal",
            message: message,
            order: newOrder ? newOrder.toObject() : null
        });
    }
});

router.get('/dana/finish', async (req, res) => {
    const { orderId, status: paymentStatusQuery, transactionStatus, responseCode, ...otherParams } = req.query;
    console.log(`DANA Finish Redirect for Order ID: ${orderId}, Status Query: ${paymentStatusQuery}, TransactionStatus: ${transactionStatus}, ResponseCode: ${responseCode}, Other Params:`, otherParams);

    let order, userMessage, pageTitle, viewName;

    try {
        if (!orderId) {
            return res.redirect('/');
        }
        order = await Order.findOne({ merchantOrderId: orderId }).populate('user');
        if (!order) {
            return res.redirect('/');
        }

        const finalStatus = (paymentStatusQuery || transactionStatus || (responseCode === '2000000' ? 'success' : 'unknown')).toLowerCase();

        switch (finalStatus) {
            case 'success':
            case 'paid':
            case 'settlement':
            case 'capture':
                pageTitle = 'Pembayaran Diproses';
                userMessage = 'Pembayaran Anda telah diterima dan sedang diproses. Status pesanan akan segera diperbarui.';
                viewName = 'order-pending';
                if (order.status === 'paid' || order.status === 'completed') {
                    pageTitle = 'Pembayaran Berhasil';
                    userMessage = 'Pembayaran Anda telah berhasil! Pesanan Anda akan segera kami proses.';
                    viewName = 'order-success';
                }
                break;
            case 'failed':
            case 'failure':
            case 'deny':
                pageTitle = 'Pembayaran Gagal';
                userMessage = 'Maaf, pembayaran Anda gagal diproses. Silakan coba lagi atau hubungi dukungan.';
                viewName = 'order-failed';
                break;
            case 'cancelled':
            case 'cancel':
            case 'expire':
                pageTitle = 'Pembayaran Dibatalkan';
                userMessage = 'Pembayaran Anda telah dibatalkan atau kedaluwarsa.';
                viewName = 'order-cancelled';
                break;
            case 'pending':
                pageTitle = 'Pembayaran Pending';
                userMessage = 'Pembayaran Anda sedang dalam status pending. Kami akan mengupdate status pesanan setelah ada konfirmasi.';
                viewName = 'order-pending';
                break;
            default:
                console.warn(`DANA Finish: Unknown or ambiguous payment status for order ${orderId}. Final status: ${finalStatus}. Query:`, req.query);
                pageTitle = 'Status Pembayaran Dalam Proses';
                userMessage = 'Kami sedang memverifikasi status pembayaran Anda. Silakan cek riwayat pesanan Anda secara berkala.';
                viewName = 'order-pending';
                break;
        }
        res.render(viewName, { title: pageTitle, order: order.toObject(), message: userMessage });

    } catch (error) {
        console.error("Error di DANA finish redirect:", error);
        res.redirect('/');
    }
});

router.post('/dana/notify', async (req, res) => {
    console.log("=== DANA SNAP NOTIFY RECEIVED START ===");
    console.log("Timestamp:", new Date().toISOString());
    console.log("Headers:", JSON.stringify(req.headers, null, 2));
    console.log("Body:", JSON.stringify(req.body, null, 2));
    console.log("=== DANA SNAP NOTIFY RECEIVED END ===");

    const notification = req.body;
    const clientKeyFromConfig = danaConfig.clientId; // Untuk verifikasi signature jika diperlukan

    // const danaSnapPublicKeyForNotif = "PASTIKAN_INI_KUNCI_PUBLIK_DANA_SNAP_SANDBOX_UNTUK_NOTIFIKASI";
    // const signatureFromHeader = req.headers['x-signature']; // GANTI DENGAN NAMA HEADER SIGNATURE DARI DANA
    // const timestampFromHeader = req.headers['x-timestamp']; // GANTI DENGAN NAMA HEADER TIMESTAMP DARI DANA
    // const requestBodyStringForVerify = JSON.stringify(req.body);

    // if (!signatureFromHeader || !timestampFromHeader) {
    //     console.warn("DANA SNAP NOTIFY: Missing signature or timestamp headers.");
    //     return res.status(400).json({ responseCode: "40003", responseMessage: "Missing signature headers" });
    // }

    // const isValidSignature = verifyDanaSnapSignature(
    //     "POST",
    //     "/order/dana/notify",
    //     requestBodyStringForVerify,
    //     timestampFromHeader,
    //     signatureFromHeader,
    //     danaSnapPublicKeyForNotif,
    //     clientKeyFromConfig
    // );

    // if (!isValidSignature) {
    //     console.warn("DANA SNAP NOTIFY: Invalid signature. Notification rejected.");
    //     return res.status(400).json({ responseCode: "40001", responseMessage: "Invalid Signature" });
    // }

    try {
        const merchantOrderId = notification.partnerReferenceNo || notification.externalId;
        const danaTransactionId = notification.referenceNo || notification.transactionId;
        const transactionStatus = notification.transactionStatus;

        if (!merchantOrderId || !transactionStatus) {
             console.error("DANA SNAP NOTIFY: Invalid notification format (missing partnerReferenceNo/externalId or transactionStatus).", notification);
             return res.status(400).json({ responseCode: "40002", responseMessage: "Invalid Notification Format" });
        }

        const order = await Order.findOne({ merchantOrderId: merchantOrderId });

        if (!order) {
            console.error(`DANA SNAP NOTIFY: Order ${merchantOrderId} not found.`);
            return res.status(404).json({ responseCode: "40401", responseMessage: "Order Not Found" });
        }

        const currentStatus = order.status.toLowerCase();
        const newStatus = transactionStatus.toLowerCase();

        if ((currentStatus === 'paid' || currentStatus === 'completed' || currentStatus === 'cancelled' || currentStatus === 'failed') &&
            (order.danaTransactionId === danaTransactionId || currentStatus === newStatus) ) {
            console.log(`DANA SNAP NOTIFY: Order ${merchantOrderId} already processed (status: ${order.status}). Ignoring.`);
            return res.status(200).json({ responseCode: "20000", responseMessage: "Notification Already Processed" });
        }

        let user;
        if (['success', 'settlement', 'capture', 'paid'].includes(newStatus)) {
            if (currentStatus !== 'paid' && currentStatus !== 'completed') {
                order.status = 'paid';
                order.paidAt = new Date();
                order.danaTransactionId = danaTransactionId || order.danaTransactionId;

                for (const item of order.items) {
                    await Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } });
                }

                user = await User.findById(order.user);
                if (user && order.totalPointsEarned > 0) {
                    user.pointsBalance = (user.pointsBalance || 0) + order.totalPointsEarned;
                    await user.save();
                    await PointTransaction.create({
                        user: user._id,
                        order: order._id,
                        points: order.totalPointsEarned,
                        type: 'earn_purchase',
                        description: `Poin dari order #${order.merchantOrderId}`
                    });
                    console.log(`DANA SNAP NOTIFY: Points awarded to user ${user.username}: ${order.totalPointsEarned} for order ${merchantOrderId}.`);
                }
                await order.save();
                console.log(`DANA SNAP NOTIFY: Order ${merchantOrderId} status updated to PAID/SUCCESS.`);
            }
        } else if (['failed', 'failure', 'deny'].includes(newStatus)) {
            if (currentStatus !== 'failed') {
                order.status = 'failed';
                await order.save();
                console.log(`DANA SNAP NOTIFY: Order ${merchantOrderId} status updated to FAILED.`);
            }
        } else if (['cancelled', 'cancel', 'expire', 'closed'].includes(newStatus)) {
             if (currentStatus !== 'cancelled') {
                order.status = 'cancelled';
                await order.save();
                console.log(`DANA SNAP NOTIFY: Order ${merchantOrderId} status updated to CANCELLED/EXPIRED/CLOSED.`);
            }
        } else if (newStatus === 'pending') {
            console.log(`DANA SNAP NOTIFY: Order ${merchantOrderId} is PENDING.`);
        } else {
            console.warn(`DANA SNAP NOTIFY: Unhandled transaction status "${transactionStatus}" for order ${merchantOrderId}.`);
        }
        res.status(200).json({ responseCode: "20000", responseMessage: "Notification Processed Successfully" });
    } catch (error) {
        console.error('DANA SNAP NOTIFY: Error processing notification:', error);
        res.status(500).json({ responseCode: "50000", responseMessage: "Internal Server Error" });
    }
});

module.exports = router;