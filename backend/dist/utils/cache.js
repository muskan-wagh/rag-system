"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCached = getCached;
exports.setCache = setCache;
const manager_1 = require("@/services/redis/manager");
const logger_1 = require("@/utils/logger");
async function getCached(key) {
    const client = (0, manager_1.getRedisClient)();
    if (!client)
        return undefined;
    try {
        const val = await client.get(key);
        if (val)
            return JSON.parse(val);
    }
    catch {
        // cache miss
    }
    return undefined;
}
async function setCache(key, value, ttlMs = 300000) {
    const client = (0, manager_1.getRedisClient)();
    if (!client)
        return;
    try {
        await client.set(key, JSON.stringify(value), 'PX', ttlMs);
    }
    catch (err) {
        logger_1.logger.warn('Cache set failed', { error: err });
    }
}
//# sourceMappingURL=cache.js.map