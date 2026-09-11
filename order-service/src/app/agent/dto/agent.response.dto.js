"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentEarningsResponseDTO = exports.AgentEarningItemDTO = exports.DeliveryTaskResponseDTO = void 0;
/**
 * Compact view of an order shaped for the courier app — only the fields a
 * driver needs to do the job. We deliberately omit customer PII (name, phone)
 * and item-level details until pickup; both are looked up via separate calls
 * if/when the driver app needs them.
 */
class DeliveryTaskResponseDTO {
    orderId; // public_id
    status;
    pickup;
    dropoff;
    total;
    currency;
    paymentMethod;
    assignedAt;
    pickedAt;
    deliveredAt;
    static from(order, branch) {
        const dto = new DeliveryTaskResponseDTO();
        dto.orderId = order.publicId;
        dto.status = order.status;
        dto.pickup = {
            branchId: order.branchId,
            lat: branch ? branch.lat : null,
            lng: branch ? branch.lng : null,
            name: branch ? branch.name : null,
            addressText: branch ? branch.addressText : null,
        };
        dto.dropoff = {
            lat: order.deliveryLat,
            lng: order.deliveryLng,
            addressText: order.deliveryAddressTextSnapshot,
        };
        dto.total = order.total;
        dto.currency = order.currency;
        dto.paymentMethod = order.paymentMethod;
        dto.assignedAt = order.assignedAt ? order.assignedAt.toISOString() : null;
        dto.pickedAt = order.pickedAt ? order.pickedAt.toISOString() : null;
        dto.deliveredAt = order.deliveredAt ? order.deliveredAt.toISOString() : null;
        return dto;
    }
}
exports.DeliveryTaskResponseDTO = DeliveryTaskResponseDTO;
class AgentEarningItemDTO {
    orderId;
    amount;
    currency;
    earnedAt;
    static from(e) {
        const dto = new AgentEarningItemDTO();
        dto.orderId = e.orderId;
        dto.amount = e.amount;
        dto.currency = e.currency;
        dto.earnedAt = e.earnedAt.toISOString();
        return dto;
    }
}
exports.AgentEarningItemDTO = AgentEarningItemDTO;
class AgentEarningsResponseDTO {
    range;
    totals;
    items;
    static from(from, to, items, sum) {
        const dto = new AgentEarningsResponseDTO();
        dto.range = { from: from.toISOString(), to: to.toISOString() };
        dto.totals = {
            count: items.length,
            sum,
            currency: items[0]?.currency ?? null,
        };
        dto.items = items.map(AgentEarningItemDTO.from);
        return dto;
    }
}
exports.AgentEarningsResponseDTO = AgentEarningsResponseDTO;
