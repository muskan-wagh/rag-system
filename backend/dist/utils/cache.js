"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCached = getCached;
exports.setCache = setCache;
const ioredis_1 = __importDefault(require("ioredis"));
const config_1 = require("@/config");
const logger_1 = require("@/utils/logger");
const REDIS_PLACEHOLDER = 'YOUR_UPSTASH_PASSWORD';
let redis = null;
function getRedis() {
    if (redis)
        return redis;
    if (config_1.config.redis.url.includes(REDIS_PLACEHOLDER)) {
        logger_1.logger.warn('Redis not configured — cache disabled. Set REDIS_URL in .env');
        return null;
    }
    redis = new ioredis_1.default(config_1.config.redis.url, {
        lazyConnect: true,
        maxRetriesPerRequest: null,
        retryStrategy: (times) => {
            if (times > 3)
                return null;
            return Math.min(times * 200, 1000);
        },
    });
    redis.on('error', (err) => {
        logger_1.logger.warn('Cache Redis error', { error: err.message });
    });
    return redis;
}
async function getCached(key) {
    const client = getRedis();
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
    const client = getRedis();
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