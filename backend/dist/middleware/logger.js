"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = requestLogger;
const logger_1 = require("@/utils/logger");
const crypto_1 = __importDefault(require("crypto"));
function requestLogger(req, res, next) {
    const requestId = crypto_1.default.randomUUID().slice(0, 8);
    const start = Date.now();
    req.requestId = requestId;
    res.on('finish', () => {
        const duration = Date.now() - start;
        const level = res.statusCode >= 400 ? 'warn' : 'info';
        logger_1.logger[level](`${req.method} ${req.path} ${res.statusCode} ${duration}ms`, {
            requestId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration,
        });
    });
    next();
}
//# sourceMappingURL=logger.js.map