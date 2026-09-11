"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCustomerAddress = getCustomerAddress;
exports.flattenAddress = flattenAddress;
const core_client_1 = require("./core-client");
async function getCustomerAddress(addressId, correlationId) {
    const res = await core_client_1.coreClient.request({
        method: "GET",
        path: `/api/customer/addresses/internal/${addressId}`,
        correlationId,
    });
    return res.data;
}
/**
 * Compose a flat address string from the structured address pieces, used as
 * `delivery_address_text_snapshot` on the order.
 */
function flattenAddress(a) {
    const parts = [a.building, a.street, a.city, a.country].filter(Boolean);
    return parts.join(", ");
}
