"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCached = getCached;
exports.setCache = setCache;
const cache = new Map();
const MAX_ENTRIES = 500;
const accessOrder = [];
function touchKey(key) {
    const idx = accessOrder.indexOf(key);
    if (idx !== -1) {
        accessOrder.splice(idx, 1);
    }
    accessOrder.push(key);
}
function evictLRU() {
    while (cache.size > MAX_ENTRIES) {
        const oldest = accessOrder.shift();
        if (oldest !== undefined) {
            cache.delete(oldest);
        }
    }
}
function getCached(key) {
    const entry = cache.get(key);
    if (!entry)
        return undefined;
    if (Date.now() > entry.expiry) {
        cache.delete(key);
        const idx = accessOrder.indexOf(key);
        if (idx !== -1)
            accessOrder.splice(idx, 1);
        return undefined;
    }
    touchKey(key);
    return entry.value;
}
function setCache(key, value, ttlMs = 300000) {
    cache.set(key, { value, expiry: Date.now() + ttlMs });
    touchKey(key);
    evictLRU();
}
//# sourceMappingURL=cache.js.map