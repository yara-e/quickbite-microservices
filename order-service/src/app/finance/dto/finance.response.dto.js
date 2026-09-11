"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayoutResponseDTO = exports.RestaurantBalanceResponseDTO = void 0;
class RestaurantBalanceResponseDTO {
    restaurantId;
    balances;
    asOf;
    static from(restaurantId, rows) {
        const dto = new RestaurantBalanceResponseDTO();
        dto.restaurantId = restaurantId;
        dto.balances = rows.map((r) => ({ currency: r.currency, balance: r.balance }));
        dto.asOf = new Date().toISOString();
        return dto;
    }
}
exports.RestaurantBalanceResponseDTO = RestaurantBalanceResponseDTO;
class PayoutResponseDTO {
    id;
    amount;
    currency;
    status;
    providerReferenceId;
    createdAt;
    static from(t) {
        const dto = new PayoutResponseDTO();
        dto.id = t.id;
        dto.amount = t.amount;
        dto.currency = t.currency;
        dto.status = t.status;
        dto.providerReferenceId = t.providerReferenceId;
        dto.createdAt = t.createdAt.toISOString();
        return dto;
    }
}
exports.PayoutResponseDTO = PayoutResponseDTO;
