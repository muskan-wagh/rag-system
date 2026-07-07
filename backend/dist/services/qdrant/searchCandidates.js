"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchByEmbedding = searchByEmbedding;
const client_1 = require("./client");
const config_1 = require("@/config");
const logger_1 = require("@/utils/logger");
const normalizePayload_1 = require("./normalizePayload");
async function searchByEmbedding(embedding, limit = 10, filters) {
    logger_1.logger.info('Searching candidates by embedding', { limit });
    const client = (0, client_1.getQdrantClient)();
    const filterConditions = [];
    if (filters?.minExperience !== undefined) {
        filterConditions.push({
            key: 'experience',
            range: { gte: filters.minExperience },
        });
    }
    if (filters?.maxExperience !== undefined) {
        filterConditions.push({
            key: 'experience',
            range: { lte: filters.maxExperience },
        });
    }
    if (filters?.skills && filters.skills.length > 0) {
        filterConditions.push({
            key: 'skills',
            match: { any: filters.skills },
        });
    }
    if (filters?.educationLevel) {
        filterConditions.push({
            key: 'education_level',
            match: { value: filters.educationLevel },
        });
    }
    const searchResult = await client.search(config_1.config.qdrant.collectionName, {
        vector: embedding,
        limit,
        with_payload: true,
        ...(filterConditions.length > 0 ? { filter: { must: filterConditions } } : {}),
    });
    const results = searchResult.map((hit) => ({
        candidate: hit.payload ? (0, normalizePayload_1.normalizeCandidatePayload)(hit.payload) : {},
        score: hit.score ?? 0,
    }));
    logger_1.logger.info(`Found ${results.length} candidate matches`);
    return results;
}
//# sourceMappingURL=searchCandidates.js.map