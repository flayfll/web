const crypto = require('crypto');
const danaConfig = require('../config/dana');

function generateSignature(httpMethod, endpointPath, requestBodyString, timestamp) {
    const clientKey = danaConfig.clientId;
    const stringToSign = `${httpMethod}:${endpointPath}:${clientKey}:${timestamp}:${requestBodyString}`;

    console.log("DANA String to Sign:", stringToSign);

    const signer = crypto.createSign('RSA-SHA256');
    signer.update(stringToSign);
    signer.end();

    try {
        const signature = signer.sign(danaConfig.privateKey, 'base64');
        console.log("DANA Generated Signature:", signature);
        return signature;
    } catch (error) {
        console.error("DANA Signing Error in utils/danaSignature.js:", error.message);
        console.error("DANA Private Key (first 50 chars for check):", (danaConfig.privateKey || '').substring(0, 50));
        console.error("DANA Private Key includes newline char?:", (danaConfig.privateKey || '').includes('\n'));
        throw new Error(`DANA Signature Generation Failed: ${error.message}`);
    }
}

function verifySignature(httpMethod, endpointPath, responseBodyString, timestamp, signatureToVerify, danaPublicKeyForVerification) {
    if (!danaPublicKeyForVerification) {
        console.warn("DANA Signature Verification: DANA's public key for verification is missing.");
        return false; // Cannot verify without DANA's public key
    }

    const stringToSign = `${httpMethod}:${endpointPath}:${danaConfig.clientId}:${timestamp}:${responseBodyString}`;
    console.log("DANA String to Verify (Notification):", stringToSign);

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(stringToSign);
    verifier.end();

    try {
        const isValid = verifier.verify(danaPublicKeyForVerification, signatureToVerify, 'base64');
        console.log("DANA Notification Signature Valid:", isValid);
        return isValid;
    } catch (error) {
        console.error("DANA Signature Verification Error:", error.message);
        return false;
    }
}

module.exports = {
    generateSignature,
    verifySignature
};