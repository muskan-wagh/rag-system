"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllCandidates = getAllCandidates;
const client_1 = require("./client");
const config_1 = require("@/config");
const logger_1 = require("@/utils/logger");
async function getAllCandidates() {
    const client = (0, client_1.getQdrantClient)();
    const collectionName = config_1.config.qdrant.collectionName;
    let allPoints = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let nextOffset = undefined;
    do {
        const result = await client.scroll(collectionName, {
            limit: 100,
            offset: nextOffset,
            with_payload: true,
        });
        allPoints = allPoints.concat(result.points);
        nextOffset = result.next_page_offset;
    } while (nextOffset != null);
    const candidates = allPoints.map((p) => p.payload);
    logger_1.logger.info(`Retrieved ${candidates.length} candidates from Qdrant`);
    return candidates;
}
//# sourceMappingURL=getAllCandidates.js.map