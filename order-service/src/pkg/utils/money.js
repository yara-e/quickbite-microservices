"use strict";
// All money in this service is expressed as INT minor units
// (piasters, halalas). Display formatting is the client's job.
Object.defineProperty(exports, "__esModule", { value: true });
exports.toMinor = toMinor;
exports.fromMinor = fromMinor;
exports.sumMinor = sumMinor;
exports.multiplyMinor = multiplyMinor;
function toMinor(majorUnits) {
    return Math.round(majorUnits * 100);
}
function fromMinor(minor) {
    return minor / 100;
}
function sumMinor(values) {
    let total = 0;
    for (const v of values)
        total += v;
    return total;
}
function multiplyMinor(unitPriceMinor, quantity) {
    return unitPriceMinor * quantity;
}
