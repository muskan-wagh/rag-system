"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retrieveCandidateById = retrieveCandidateById;
exports.retrieveCandidatesByIds = retrieveCandidatesByIds;
const client_1 = require("./client");
const config_1 = require("@/config");
async function retrieveCandidateById(id) {
    const client = (0, client_1.getQdrantClient)();
    const result = await client.scroll(config_1.config.qdrant.collectionName, {
        limit: 1,
        filter: {
            must: [{ key: 'id', match: { value: id } }],
        },
        with_payload: true,
    });
    const point = result.points[0];
    if (!point)
        return null;
    return point.payload;
}
async function retrieveCandidatesByIds(ids) {
    const client = (0, client_1.getQdrantClient)();
    const result = await client.scroll(config_1.config.qdrant.collectionName, {
        limit: ids.length,
        filter: {
            should: ids.map((id) => ({ key: 'id', match: { value: id } })),
        },
        with_payload: true,
    });
    return result.points
        .filter((p) => p.payload !== null && p.payload !== undefined)
        .map((p) => p.payload);
}
//# sourceMappingURL=retrieveCandidates.js.map