"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegionNotResolvedError = void 0;
const AppError_1 = require("../error/AppError");
exports.RegionNotResolvedError = new AppError_1.AppError("Region not resolved. Provide ?region= or X-Region header, or authenticate.", 400);
