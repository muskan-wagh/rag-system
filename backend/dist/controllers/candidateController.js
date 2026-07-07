"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSimilarCandidatesHandler = exports.getCandidateNotesHandler = exports.addCandidateNoteHandler = exports.updateCandidateStatusHandler = exports.compareCandidatesHandler = exports.closingStrategyHandler = exports.screeningQuestionsHandler = exports.batchCandidatesHandler = exports.getCandidateHandler = exports.searchCandidatesHandler = void 0;
const crypto_1 = __importDefault(require("crypto"));
const asyncHandler_1 = require("@/utils/asyncHandler");
const parseJD_1 = require("@/services/llm/parseJD");
const embedding_1 = require("@/services/embedding");
const searchCandidates_1 = require("@/services/qdrant/searchCandidates");
const retrieveCandidates_1 = require("@/services/qdrant/retrieveCandidates");
const finalRanker_1 = require("@/services/ranking/finalRanker");
const compareCandidates_1 = require("@/services/llm/compareCandidates");
const screeningQuestions_1 = require("@/services/llm/screeningQuestions");
const closingStrategy_1 = require("@/services/llm/closingStrategy");
const client_1 = require("@/services/supabase/client");
const database_1 = require("@/services/supabase/database");
const logger_1 = require("@/utils/logger");
const errorHandler_1 = require("@/middleware/errorHandler");
const cache_1 = require("@/utils/cache");
exports.searchCandidatesHandler = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { jdText, limit = 20, filters } = req.body;
    if (!jdText || typeof jdText !== 'string') {
        res.status(400).json({ success: false, error: 'jdText is required and must be a string' });
        return;
    }
    logger_1.logger.info('Search candidates request', { textLength: jdText.length, limit });
    const cacheKey = `search:${crypto_1.default.createHash('md5').update(jdText).digest('hex')}:${limit}:${JSON.stringify(filters ?? {})}`;
    const cached = (0, cache_1.getCached)(cacheKey);
    if (cached) {
        logger_1.logger.info('Returning cached search results', { resultCount: cached.results.length });
        res.status(200).json({ success: true, data: cached });
        return;
    }
    const [jd, embedding] = await Promise.all([
        (0, parseJD_1.parseJD)(jdText),
        (0, embedding_1.generateEmbedding)(jdText),
    ]);
    const rawResults = await (0, searchCandidates_1.searchByEmbedding)(embedding, limit, filters);
    if (rawResults.length === 0) {
        const data = { results: [], query: jd };
        (0, cache_1.setCache)(cacheKey, data, 300000);
        res.status(200).json({ success: true, data });
        return;
    }
    const semanticScores = new Map();
    const candidates = rawResults.map((r) => {
        semanticScores.set(r.candidate.id, r.score);
        return r.candidate;
    });
    const rankedResults = await (0, finalRanker_1.rankCandidates)(candidates, jd, semanticScores);
    const data = { results: rankedResults, query: jd };
    (0, cache_1.setCache)(cacheKey, data, 300000);
    logger_1.logger.info('Sending search response', { resultCount: rankedResults.length });
    res.status(200).json({ success: true, data });
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
exports.screeningQuestionsHandler = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    if (!id) {
        res.status(400).json({ success: false, error: 'Candidate ID is required' });
        return;
    }
    logger_1.logger.info('Generate screening questions', { candidateId: id });
    const candidate = await (0, retrieveCandidates_1.retrieveCandidateById)(id);
    if (!candidate) {
        res.status(404).json({ success: false, error: 'Candidate not found' });
        return;
    }
    const supabase = (0, client_1.getSupabaseClient)();
    const { data: sessionData } = await supabase
        .from('candidates')
        .select('raw_resume_text, upload_session_id')
        .eq('id', id)
        .single();
    let jdText = '';
    if (sessionData?.upload_session_id) {
        const { data: sess } = await supabase
            .from('upload_sessions')
            .select('job_description_text')
            .eq('id', sessionData.upload_session_id)
            .single();
        jdText = sess?.job_description_text || '';
    }
    const resumeText = sessionData?.raw_resume_text || candidate.summary || '';
    const result = await (0, screeningQuestions_1.generateScreeningQuestions)(jdText, resumeText);
    res.status(200).json({ success: true, data: result });
});
exports.closingStrategyHandler = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    if (!id) {
        res.status(400).json({ success: false, error: 'Candidate ID is required' });
        return;
    }
    logger_1.logger.info('Generate closing strategy', { candidateId: id });
    const candidate = await (0, retrieveCandidates_1.retrieveCandidateById)(id);
    if (!candidate) {
        res.status(404).json({ success: false, error: 'Candidate not found' });
        return;
    }
    const supabase = (0, client_1.getSupabaseClient)();
    const { data: sessionData } = await supabase
        .from('candidates')
        .select('raw_resume_text, upload_session_id')
        .eq('id', id)
        .single();
    let jdText = '';
    if (sessionData?.upload_session_id) {
        const { data: sess } = await supabase
            .from('upload_sessions')
            .select('job_description_text')
            .eq('id', sessionData.upload_session_id)
            .single();
        jdText = sess?.job_description_text || '';
    }
    const resumeText = sessionData?.raw_resume_text || candidate.summary || '';
    const result = await (0, closingStrategy_1.generateClosingStrategy)(jdText, resumeText);
    res.status(200).json({ success: true, data: result });
});
exports.compareCandidatesHandler = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { jdText, candidateIds } = req.body;
    if (!jdText || typeof jdText !== 'string') {
        res.status(400).json({ success: false, error: 'jdText is required and must be a string' });
        return;
    }
    if (!Array.isArray(candidateIds) || candidateIds.length < 2) {
        res.status(400).json({ success: false, error: 'candidateIds must be an array with at least 2 IDs' });
        return;
    }
    logger_1.logger.info('Compare candidates request', { candidateIds });
    const jd = await (0, parseJD_1.parseJD)(jdText);
    const candidates = await (0, retrieveCandidates_1.retrieveCandidatesByIds)(candidateIds);
    if (candidates.length < 2) {
        throw new errorHandler_1.AppError('Could not find all specified candidates', 404);
    }
    const comparisonText = await (0, compareCandidates_1.compareCandidates)(candidates, jd);
    res.status(200).json({ success: true, data: { comparison: comparisonText, query: jd } });
});
exports.updateCandidateStatusHandler = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const { status } = req.body;
    if (!id) {
        res.status(400).json({ success: false, error: 'Candidate ID is required' });
        return;
    }
    const validStatuses = ['Applied', 'Screening', 'Technical Interview', 'HR Interview', 'Offer', 'Hired', 'Rejected'];
    if (!status || !validStatuses.includes(status)) {
        res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
        return;
    }
    logger_1.logger.info('Update candidate status', { candidateId: id, status });
    await (0, database_1.updateCandidateStatus)(id, status);
    res.status(200).json({ success: true, data: { message: `Candidate status updated to ${status}` } });
});
exports.addCandidateNoteHandler = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const { noteText } = req.body;
    if (!id) {
        res.status(400).json({ success: false, error: 'Candidate ID is required' });
        return;
    }
    if (!noteText || typeof noteText !== 'string' || noteText.trim().length === 0) {
        res.status(400).json({ success: false, error: 'noteText is required and must be a non-empty string' });
        return;
    }
    logger_1.logger.info('Add candidate note', { candidateId: id });
    await (0, database_1.addCandidateNote)(id, noteText.trim());
    res.status(200).json({ success: true, data: { message: 'Note added' } });
});
exports.getCandidateNotesHandler = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    if (!id) {
        res.status(400).json({ success: false, error: 'Candidate ID is required' });
        return;
    }
    logger_1.logger.info('Get candidate notes', { candidateId: id });
    const notes = await (0, database_1.getCandidateNotes)(id);
    res.status(200).json({ success: true, data: notes });
});
exports.getSimilarCandidatesHandler = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    if (!id) {
        res.status(400).json({ success: false, error: 'Candidate ID is required' });
        return;
    }
    logger_1.logger.info('Get similar candidates', { candidateId: id });
    const candidate = await (0, retrieveCandidates_1.retrieveCandidateById)(id);
    if (!candidate) {
        res.status(404).json({ success: false, error: 'Candidate not found' });
        return;
    }
    const embeddingText = `${candidate.name} Skills: ${candidate.skills.join(', ')}`;
    const embedding = await (0, embedding_1.generateEmbedding)(embeddingText);
    const similar = await (0, searchCandidates_1.searchByEmbedding)(embedding, 10, {});
    const filtered = similar.filter((r) => r.candidate.id !== id);
    res.status(200).json({ success: true, data: filtered.slice(0, 5).map((r) => r.candidate) });
});
//# sourceMappingURL=candidateController.js.map