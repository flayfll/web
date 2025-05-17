require('dotenv').config();

const appBaseUrl = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

module.exports = {
    apiBaseUrl: process.env.DANA_API_BASE_URL,
    merchantId: process.env.DANA_MERCHANT_ID,
    clientId: process.env.DANA_CLIENT_ID,
    clientSecret: process.env.DANA_CLIENT_SECRET,
    publicKey: (process.env.DANA_PUBLIC_KEY || '').replace(/\\n/g, '\n'),
    privateKey: (process.env.DANA_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    paymentNotifyUrl: `${appBaseUrl}/order/dana/notify`,
    paymentRedirectUrl: `${appBaseUrl}/order/dana/finish`
};