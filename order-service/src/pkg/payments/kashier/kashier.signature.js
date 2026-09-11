"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSignaturePayload = buildSignaturePayload;
exports.computeWebhookSignature = computeWebhookSignature;
exports.verifyWebhookSignature = verifyWebhookSignature;
const crypto_1 = require("crypto");
/**
 * Kashier webhook signature verification.
 *
 * Per https://developers.kashier.io/webhooks/setup and verified against live
 * webhooks:
 *   1. Read `signatureKeys` from the inbound `data` object.
 *   2. Sort the field names alphabetically.
 *   3. Build `key=encodeURIComponent(value)&...` joined with `&`. Values
 *      MUST be URL-encoded — Kashier signs the encoded form, so unencoded
 *      strings with spaces/colons/pipes produce a different digest.
 *   4. HMAC-SHA256 with the Payment API Key as the secret.
 *   5. Compare the hex digest with the `x-kashier-signature` header.
 *
 * Numbers are stringified verbatim by JS (`16.3`, `100`); the parsed envelope
 * matches what Kashier signs because we both go through JSON parse/serialize.
 */
function buildSignaturePayload(data, signatureKeys) {
    return [...signatureKeys]
        .sort()
        .map((k) => {
        const v = data[k];
        const stringified = v === undefined || v === null ? "" : String(v);
        return `${k}=${encodeURIComponent(stringified)}`;
    })
        .join("&");
}
function computeWebhookSignature(data, signatureKeys, apiKey) {
    const payload = buildSignaturePayload(data, signatureKeys);
    return (0, crypto_1.createHmac)("sha256", apiKey).update(payload, "utf8").digest("hex");
}
function verifyWebhookSignature(data, signatureKeys, apiKey, providedSignature) {
    if (!providedSignature || typeof providedSignature !== "string")
        return false;
    const expected = computeWebhookSignature(data, signatureKeys, apiKey);
    if (expected.length !== providedSignature.length)
        return false;
    try {
        return (0, crypto_1.timingSafeEqual)(Buffer.from(expected, "hex"), Buffer.from(providedSignature, "hex"));
    }
    catch {
        return false;
    }
}
