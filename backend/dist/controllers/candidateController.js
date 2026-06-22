"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compareCandidatesHandler = exports.batchCandidatesHandler = exports.getCandidateHandler = exports.searchCandidatesHandler = void 0;
const asyncHandler_1 = require("@/utils/asyncHandler");
const parseJD_1 = require("@/services/llm/parseJD");
const searchCandidates_1 = require("@/services/qdrant/searchCandidates");
const retrieveCandidates_1 = require("@/services/qdrant/retrieveCandidates");
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
exports.getCandidateHandler = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    if (!id) {
        res.status(400).json({ success: false, error: 'Candidate ID is required' });
        return;
    }
    logger_1.logger.info('Get candidate by ID', { candidateId: id });
    const candidate = await (0, retrieveCandidates_1.retrieveCandidateById)(id);
    if (!candidate) {
        res.status(404).json({ success: false, error: 'Candidate not found' });
        return;
    }
    res.status(200).json({ success: true, data: candidate });
});
exports.batchCandidatesHandler = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ success: false, error: 'ids must be a non-empty array' });
        return;
    }
    logger_1.logger.info('Batch get candidates', { count: ids.length });
    const candidates = await (0, retrieveCandidates_1.retrieveCandidatesByIds)(ids);
    res.status(200).json({ success: true, data: candidates });
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
    const candidates = await (0, retrieveCandidates_1.retrieveCandidatesByIds)(candidateIds);
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