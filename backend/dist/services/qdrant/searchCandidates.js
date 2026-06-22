"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchCandidates = searchCandidates;
const client_1 = require("./client");
const client_2 = require("@/services/llm/client");
const config_1 = require("@/config");
const logger_1 = require("@/utils/logger");
async function searchCandidates(queryText, limit = 10, filters) {
    logger_1.logger.info('Searching candidates', { queryLength: queryText.length, limit });
    const embedding = await (0, client_2.generateEmbedding)(queryText);
    const client = (0, client_1.getQdrantClient)();
    const filterConditions = [];
    if (filters?.minExperience !== undefined) {
        filterConditions.push({
            field: 'experience',
            match: { gte: filters.minExperience },
        });
    }
    if (filters?.maxExperience !== undefined) {
        filterConditions.push({
            field: 'experience',
            match: { lte: filters.maxExperience },
        });
    }
    if (filters?.skills && filters.skills.length > 0) {
        filterConditions.push({
            field: 'skills',
            match: { any: filters.skills },
        });
    }
    if (filters?.educationLevel) {
        filterConditions.push({
            field: 'education.level',
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
        candidate: hit.payload,
        score: hit.score ?? 0,
    }));
    logger_1.logger.info(`Found ${results.length} candidate matches`);
    return results;
}
//# sourceMappingURL=searchCandidates.js.map