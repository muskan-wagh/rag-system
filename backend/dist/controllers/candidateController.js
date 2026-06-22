"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compareCandidatesHandler = exports.searchCandidatesHandler = void 0;
const asyncHandler_1 = require("@/utils/asyncHandler");
const parseJD_1 = require("@/services/llm/parseJD");
const searchCandidates_1 = require("@/services/qdrant/searchCandidates");
const finalRanker_1 = require("@/services/ranking/finalRanker");
const compareCandidates_1 = require("@/services/llm/compareCandidates");
const logger_1 = require("@/utils/logger");
const errorHandler_1 = require("@/middleware/errorHandler");
exports.searchCandidatesHandler = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { jdText, limit = 20, filters } = req.body;
    if (!jdText || typeof jdText !== 'string') {
        res.status(400).json({
            success: false,
            error: 'jdText is required and must be a string',
        });
        return;
    }
    logger_1.logger.info('Search candidates request', { textLength: jdText.length, limit });
    const jd = await (0, parseJD_1.parseJD)(jdText);
    const queryText = [
        `Job: ${jd.title}`,
        `Skills: ${jd.skills.join(', ')}`,
        `Experience: ${jd.experience.min}-${jd.experience.max} years`,
        `Education: ${jd.education.level} in ${jd.education.field}`,
        `Requirements: ${jd.requirements.join(', ')}`,
    ].join('. ');
    const rawResults = await (0, searchCandidates_1.searchCandidates)(queryText, limit, filters);
    if (rawResults.length === 0) {
        res.status(200).json({
            success: true,
            data: { results: [], query: jd },
        });
        return;
    }
    const candidates = rawResults.map((r) => r.candidate);
    const rankedResults = await (0, finalRanker_1.rankCandidates)(candidates, jd);
    logger_1.logger.info('Sending search response', { resultCount: rankedResults.length });
    res.status(200).json({
        success: true,
        data: { results: rankedResults, query: jd },
    });
});
exports.compareCandidatesHandler = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { jdText, candidateIds } = req.body;
    if (!jdText || typeof jdText !== 'string') {
        res.status(400).json({
            success: false,
            error: 'jdText is required and must be a string',
        });
        return;
    }
    if (!Array.isArray(candidateIds) || candidateIds.length < 2) {
        res.status(400).json({
            success: false,
            error: 'candidateIds must be an array with at least 2 IDs',
        });
        return;
    }
    logger_1.logger.info('Compare candidates request', { candidateIds });
    const jd = await (0, parseJD_1.parseJD)(jdText);
    const queryText = [
        `Job: ${jd.title}`,
        `Skills: ${jd.skills.join(', ')}`,
        `Experience: ${jd.experience.min}-${jd.experience.max} years`,
        `Education: ${jd.education.level} in ${jd.education.field}`,
    ].join('. ');
    const rawResults = await (0, searchCandidates_1.searchCandidates)(queryText, candidateIds.length, {
        skills: jd.skills,
    });
    const candidateMap = new Map(rawResults.map((r) => [r.candidate.id, r.candidate]));
    const candidates = [];
    for (const id of candidateIds) {
        const candidate = candidateMap.get(id);
        if (candidate) {
            candidates.push(candidate);
        }
    }
    if (candidates.length < 2) {
        throw new errorHandler_1.AppError('Could not find all specified candidates', 404);
    }
    const comparisonText = await (0, compareCandidates_1.compareCandidates)(candidates, jd);
    res.status(200).json({
        success: true,
        data: { comparison: comparisonText, query: jd },
    });
});
//# sourceMappingURL=candidateController.js.map