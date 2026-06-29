"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertCandidate = insertCandidate;
exports.insertCandidates = insertCandidates;
const client_1 = require("./client");
const client_2 = require("@/services/llm/client");
const config_1 = require("@/config");
const logger_1 = require("@/utils/logger");
function buildCandidateText(candidate) {
    return [
        candidate.name,
        candidate.summary,
        `Skills: ${candidate.skills.join(', ')}`,
        `Experience: ${candidate.experience} years`,
        `Education: ${candidate.education.level} in ${candidate.education.field}`,
        candidate.education.details,
    ]
        .filter(Boolean)
        .join('. ');
}
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 1000;
async function insertCandidate(candidate) {
    logger_1.logger.info('Inserting candidate', { candidateId: candidate.id });
    const text = buildCandidateText(candidate);
    const embedding = await (0, client_2.generateEmbedding)(text);
    const client = (0, client_1.getQdrantClient)();
    await client.upsert(config_1.config.qdrant.collectionName, {
        points: [
            {
                id: candidate.id,
                vector: embedding,
                payload: candidate,
            },
        ],
    });
    logger_1.logger.info('Candidate inserted successfully', { candidateId: candidate.id });
}
async function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function insertCandidates(candidates) {
    logger_1.logger.info(`Inserting ${candidates.length} candidates`);
    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
        const batch = candidates.slice(i, i + BATCH_SIZE);
        const points = await Promise.all(batch.map(async (candidate) => {
            const text = buildCandidateText(candidate);
            const embedding = await (0, client_2.generateEmbedding)(text);
            return {
                id: candidate.id,
                vector: embedding,
                payload: candidate,
            };
        }));
        const client = (0, client_1.getQdrantClient)();
        await client.upsert(config_1.config.qdrant.collectionName, { points });
        logger_1.logger.info(`Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} candidates`);
        if (i + BATCH_SIZE < candidates.length) {
            await delay(BATCH_DELAY_MS);
        }
    }
    logger_1.logger.info(`Inserted ${candidates.length} candidates`);
}
//# sourceMappingURL=insertCandidate.js.map