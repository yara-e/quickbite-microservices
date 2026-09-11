"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBody = validateBody;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const AppError_1 = require("../error/AppError");
function flattenMessages(errors) {
    const out = [];
    for (const e of errors) {
        if (e.constraints)
            out.push(...Object.values(e.constraints));
        if (e.children && e.children.length > 0)
            out.push(...flattenMessages(e.children));
    }
    return out;
}
async function validateBody(cls, body) {
    const instance = (0, class_transformer_1.plainToInstance)(cls, body);
    const errors = await (0, class_validator_1.validate)(instance, { whitelist: true });
    if (errors.length > 0) {
        const messages = flattenMessages(errors);
        throw new AppError_1.AppError(messages.join("\n") || "Validation failed", 400);
    }
    return instance;
}
