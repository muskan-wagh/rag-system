"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertCandidate = insertCandidate;
exports.insertCandidates = insertCandidates;
const crypto_1 = __importDefault(require("crypto"));
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
async function insertCandidate(candidate) {
    logger_1.logger.info('Inserting candidate', { candidateId: candidate.id });
    const text = buildCandidateText(candidate);
    const embedding = await (0, client_2.generateEmbedding)(text);
    const client = (0, client_1.getQdrantClient)();
    await client.upsert(config_1.config.qdrant.collectionName, {
        points: [
            {
                id: crypto_1.default.randomUUID(),
                vector: embedding,
                payload: candidate,
            },
        ],
    });
    logger_1.logger.info('Candidate inserted successfully', { candidateId: candidate.id });
}
async function insertCandidates(candidates) {
    logger_1.logger.info(`Inserting ${candidates.length} candidates`);
    const points = await Promise.all(candidates.map(async (candidate) => {
        const text = buildCandidateText(candidate);
        const embedding = await (0, client_2.generateEmbedding)(text);
        return {
            id: crypto_1.default.randomUUID(),
            vector: embedding,
            payload: candidate,
        };
    }));
    const client = (0, client_1.getQdrantClient)();
    await client.upsert(config_1.config.qdrant.collectionName, { points });
    logger_1.logger.info(`Inserted ${candidates.length} candidates`);
}
//# sourceMappingURL=insertCandidate.js.map