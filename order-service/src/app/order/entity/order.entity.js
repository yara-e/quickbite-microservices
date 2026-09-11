"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderEntity = void 0;
class OrderEntity {
    id;
    region;
    publicId;
    countryCode;
    restaurantId;
    restaurantOwnerId;
    branchId;
    customerId;
    customerAddressId;
    deliveryLat;
    deliveryLng;
    deliveryAddressTextSnapshot;
    branchLat;
    branchLng;
    status;
    subtotal;
    deliveryFee;
    serviceFee;
    total;
    commission;
    currency;
    paymentMethod;
    deliveryAgentId;
    createdAt;
    updatedAt;
    acceptedAt;
    rejectedAt;
    readyAt;
    assignedAt;
    pickedAt;
    deliveredAt;
    cancelledAt;
    constructor(data) {
        Object.assign(this, data);
    }
}
exports.OrderEntity = OrderEntity;
