"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCached = getCached;
exports.setCache = setCache;
const cache = new Map();
function getCached(key) {
    const entry = cache.get(key);
    if (!entry)
        return undefined;
    if (Date.now() > entry.expiry) {
        cache.delete(key);
        return undefined;
    }
    return entry.value;
}
function setCache(key, value, ttlMs = 300000) {
    cache.set(key, { value, expiry: Date.now() + ttlMs });
}
//# sourceMappingURL=cache.js.map