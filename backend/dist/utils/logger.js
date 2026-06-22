"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.childLogger = childLogger;
const winston_1 = __importDefault(require("winston"));
const config_1 = require("@/config");
const devFormat = winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.printf(({ timestamp, level, message, requestId, ...meta }) => {
    const trace = requestId ? ` [${requestId}]` : '';
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level}${trace}: ${message}${metaStr}`;
}));
const prodFormat = winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json());
exports.logger = winston_1.default.createLogger({
    level: config_1.config.nodeEnv === 'production' ? 'info' : 'debug',
    format: config_1.config.nodeEnv === 'production' ? prodFormat : devFormat,
    transports: [
        new winston_1.default.transports.Console(),
        ...(config_1.config.nodeEnv === 'production'
            ? [
                new winston_1.default.transports.File({ filename: 'logs/error.log', level: 'error' }),
                new winston_1.default.transports.File({ filename: 'logs/combined.log' }),
            ]
            : []),
    ],
});
function childLogger(requestId) {
    return exports.logger.child({ requestId });
}
//# sourceMappingURL=logger.js.map