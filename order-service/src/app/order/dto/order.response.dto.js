"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderDetailResponseDTO = exports.OrderStatusResponseDTO = exports.OrderSummaryResponseDTO = exports.OrderResponseDTO = exports.OrderItemResponseDTO = void 0;
const enums_1 = require("../enums");
class OrderItemResponseDTO {
    productId;
    name;
    imageUrl;
    quantity;
    unitPrice;
    lineTotal;
    static from(item) {
        const dto = new OrderItemResponseDTO();
        dto.productId = item.productId;
        dto.name = item.nameSnapshot;
        dto.imageUrl = item.imageUrlSnapshot;
        dto.quantity = item.quantity;
        dto.unitPrice = item.unitPriceSnapshot;
        dto.lineTotal = item.lineTotal;
        return dto;
    }
}
exports.OrderItemResponseDTO = OrderItemResponseDTO;
class OrderResponseDTO {
    publicId;
    status;
    paymentMethod;
    branch;
    restaurant;
    customerAddress;
    subtotal;
    deliveryFee;
    serviceFee;
    total;
    currency;
    items;
    createdAt;
    payment;
    static from(order, items, payment) {
        const dto = new OrderResponseDTO();
        dto.publicId = order.publicId;
        dto.status = order.status;
        dto.paymentMethod = order.paymentMethod;
        dto.branch = { id: Number(order.branchId) };
        dto.restaurant = { id: Number(order.restaurantId) };
        dto.customerAddress = {
            lat: Number(order.deliveryLat),
            lng: Number(order.deliveryLng),
            addressText: order.deliveryAddressTextSnapshot,
        };
        dto.subtotal = order.subtotal;
        dto.deliveryFee = order.deliveryFee;
        dto.serviceFee = order.serviceFee;
        dto.total = order.total;
        dto.currency = order.currency;
        dto.items = items.map(OrderItemResponseDTO.from);
        dto.createdAt = order.createdAt.toISOString();
        if (payment)
            dto.payment = payment;
        return dto;
    }
}
exports.OrderResponseDTO = OrderResponseDTO;
class OrderSummaryResponseDTO {
    publicId;
    status;
    total;
    currency;
    itemsCount;
    restaurant;
    branchId;
    createdAt;
    static from(order, itemsCount) {
        const dto = new OrderSummaryResponseDTO();
        dto.publicId = order.publicId;
        dto.status = order.status;
        dto.total = order.total;
        dto.currency = order.currency;
        dto.itemsCount = itemsCount;
        dto.restaurant = { id: Number(order.restaurantId) };
        dto.branchId = Number(order.branchId);
        dto.createdAt = order.createdAt.toISOString();
        return dto;
    }
}
exports.OrderSummaryResponseDTO = OrderSummaryResponseDTO;
class OrderStatusResponseDTO {
    publicId;
    status;
    updatedAt;
    static from(order) {
        const dto = new OrderStatusResponseDTO();
        dto.publicId = order.publicId;
        dto.status = order.status;
        dto.updatedAt = order.updatedAt.toISOString();
        return dto;
    }
}
exports.OrderStatusResponseDTO = OrderStatusResponseDTO;
class OrderDetailResponseDTO {
    publicId;
    status;
    paymentMethod;
    branch;
    restaurant;
    customerAddress;
    subtotal;
    deliveryFee;
    serviceFee;
    total;
    currency;
    items;
    createdAt;
    history;
    static from(order, items) {
        const dto = new OrderDetailResponseDTO();
        const base = OrderResponseDTO.from(order, items);
        Object.assign(dto, base);
        dto.history = buildHistory(order);
        return dto;
    }
}
exports.OrderDetailResponseDTO = OrderDetailResponseDTO;
function buildHistory(order) {
    const out = [];
    const push = (status, ts) => {
        if (ts)
            out.push({ status, ts: ts.toISOString() });
    };
    if (order.paymentMethod === enums_1.PaymentMethod.ONLINE) {
        push(enums_1.OrderStatus.PENDING_PAYMENT, order.createdAt);
        push(enums_1.OrderStatus.PLACED, order.createdAt);
    }
    else {
        push(enums_1.OrderStatus.PLACED, order.createdAt);
    }
    push(enums_1.OrderStatus.ACCEPTED, order.acceptedAt);
    push(enums_1.OrderStatus.REJECTED, order.rejectedAt);
    push(enums_1.OrderStatus.READY, order.readyAt);
    push(enums_1.OrderStatus.ASSIGNED, order.assignedAt);
    push(enums_1.OrderStatus.PICKED, order.pickedAt);
    push(enums_1.OrderStatus.DELIVERED, order.deliveredAt);
    push(enums_1.OrderStatus.CANCELLED, order.cancelledAt);
    return out;
}
