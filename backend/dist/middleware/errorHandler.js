"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
exports.errorHandler = errorHandler;
const logger_1 = require("@/utils/logger");
const errorCodes_1 = require("./errorCodes");
class AppError extends Error {
    statusCode;
    code;
    details;
    constructor(message, statusCode = 500, code = errorCodes_1.ErrorCodes.INTERNAL_ERROR, details) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.name = 'AppError';
    }
}
exports.AppError = AppError;
function errorHandler(err, req, res, _next) {
    if (err instanceof AppError) {
        logger_1.logger.warn(`AppError: ${err.message}`, {
            code: err.code,
            statusCode: err.statusCode,
            path: req.path,
            method: req.method,
        });
        res.status(err.statusCode).json({
            success: false,
            code: err.code,
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
        code: errorCodes_1.ErrorCodes.INTERNAL_ERROR,
        error: 'Internal server error',
    });
}
//# sourceMappingURL=errorHandler.js.map