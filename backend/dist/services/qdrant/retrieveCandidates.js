"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retrieveCandidateByIds = retrieveCandidateByIds;
const client_1 = require("./client");
const config_1 = require("@/config");
const normalizePayload_1 = require("./normalizePayload");
async function retrieveCandidateByIds(ids) {
    if (ids.length === 0)
        return [];
    const client = (0, client_1.getQdrantClient)();
    const result = await client.retrieve(config_1.config.qdrant.collectionName, {
        ids,
        with_payload: true,
    });
    return result
        .filter((p) => p.payload !== null && p.payload !== undefined)
        .map((p) => (0, normalizePayload_1.normalizeCandidatePayload)(p.payload));
}
//# sourceMappingURL=retrieveCandidates.js.map