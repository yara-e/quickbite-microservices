"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderItemEntity = void 0;
class OrderItemEntity {
    id;
    region;
    orderId;
    productId;
    quantity;
    unitPriceSnapshot;
    nameSnapshot;
    imageUrlSnapshot;
    lineTotal;
    createdAt;
    constructor(data) {
        Object.assign(this, data);
    }
}
exports.OrderItemEntity = OrderItemEntity;
