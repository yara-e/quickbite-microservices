"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RestaurantBalanceEntity = void 0;
class RestaurantBalanceEntity {
    restaurantId;
    region;
    currency;
    balance;
    updatedAt;
    constructor(data) {
        Object.assign(this, data);
    }
}
exports.RestaurantBalanceEntity = RestaurantBalanceEntity;
