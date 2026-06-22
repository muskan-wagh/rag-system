"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
exports.errorHandler = errorHandler;
const logger_1 = require("@/utils/logger");
class AppError extends Error {
    statusCode;
    details;
    constructor(message, statusCode = 500, details) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        this.name = 'AppError';
    }
}
exports.AppError = AppError;
function errorHandler(err, req, res, _next) {
    if (err instanceof AppError) {
        logger_1.logger.warn(`AppError: ${err.message}`, {
            statusCode: err.statusCode,
            path: req.path,
            method: req.method,
        });
        res.status(err.statusCode).json({
            success: false,
            error: err.message,
            details: err.details,
        });
        return;
    }
    logger_1.logger.error(`Unhandled error: ${err.message}`, {
        error: err.stack,
        path: req.path,
        method: req.method,
    });
    res.status(500).json({
        success: false,
        error: 'Internal server error',
    });
}
//# sourceMappingURL=errorHandler.js.map