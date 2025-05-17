const crypto = require('crypto');
function generateDanaSnapSignature(httpMethod, snapEndpointPath, minifiedRequestBodyString, iso8601Timestamp, clientKeyOrAccessToken, merchantPrivateKey) {
    if (!httpMethod || !snapEndpointPath || !minifiedRequestBodyString || !iso8601Timestamp || !clientKeyOrAccessToken || !merchantPrivateKey) {
        console.error("DANA SNAP Signature: Missing one or more required parameters for signature generation.");
        throw new Error("DANA SNAP Signature: Missing required parameters.");
    }

    let stringToSign = `${httpMethod.toUpperCase()}:${snapEndpointPath}:${clientKeyOrAccessToken}:${iso8601Timestamp}:${minifiedRequestBodyString}`;
    console.log("DANA SNAP String-to-Sign:", stringToSign);
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(stringToSign);
    signer.end();
    try {
        const signature = signer.sign(merchantPrivateKey, 'base64');
        console.log("DANA SNAP Generated Signature:", signature);
        return signature;
    } catch (error) {
        console.error("DANA SNAP Signing Error in utils/danaSnapSignature.js:", error.message);
        throw new Error(`DANA SNAP Signature Generation Failed: ${error.message}`);
    }
}
function verifyDanaSnapSignature(httpMethod, webhookPath, minifiedNotificationBodyString, iso8601TimestampFromHeader, signatureToVerify, danaSnapPublicKeyForVerification, clientKeyOrPartnerId) {
    if (!httpMethod || !webhookPath || !minifiedNotificationBodyString || !iso8601TimestampFromHeader || !signatureToVerify || !danaSnapPublicKeyForVerification || !clientKeyOrPartnerId) {
        console.warn("DANA SNAP Signature Verification: Missing one or more required parameters.");
        return false;
    }
    let stringToSign = `${httpMethod.toUpperCase()}:${webhookPath}:${clientKeyOrPartnerId}:${iso8601TimestampFromHeader}:${minifiedNotificationBodyString}`;
    // ==========================================================================================

    console.log("DANA SNAP String-to-Verify (Notification):", stringToSign);

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(stringToSign);
    verifier.end();

    try {
        const isValid = verifier.verify(danaSnapPublicKeyForVerification, signatureToVerify, 'base64');
        console.log("DANA SNAP Notification Signature Valid:", isValid);
        return isValid;
    } catch (error) {
        console.error("DANA SNAP Signature Verification Error:", error.message);

        return false;
    }
}

module.exports = {
    generateDanaSnapSignature,
    verifyDanaSnapSignature
};