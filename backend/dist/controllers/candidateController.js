"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllCandidatesHandler = exports.getSimilarCandidatesHandler = exports.getCandidateNotesHandler = exports.addCandidateNoteHandler = exports.getCandidateTimelineHandler = exports.sendInterviewEmailHandler = exports.generateEmailTemplateHandler = exports.rejectCandidateHandler = exports.acceptOfferHandler = exports.makeOfferHandler = exports.updateInterviewHandler = exports.getCandidateInterviewsHandler = exports.scheduleInterviewHandler = exports.updateCandidateStatusHandler = exports.compareCandidatesHandler = exports.closingStrategyHandler = exports.screeningQuestionsHandler = exports.batchCandidatesHandler = exports.getCandidateHandler = exports.searchCandidatesHandler = void 0;
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
const errorCodes_1 = require("@/middleware/errorCodes");
const cache_1 = require("@/utils/cache");
const memory_cache_1 = require("@/utils/memory-cache");
const explainability_1 = require("@/services/llm/explainability");
const emailTemplate_1 = require("@/services/llm/emailTemplate");
const websocket_1 = require("@/services/websocket");
exports.searchCandidatesHandler = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const startTime = Date.now();
    const { jdText, limit = 20, filters, explain = false } = req.body;
    const jdHash = crypto_1.default.createHash('md5').update(jdText).digest('hex');
    const cacheKey = `search:${jdHash}:${limit}:${JSON.stringify(filters ?? {})}:${explain}`;
    const cached = await (0, cache_1.getCached)(cacheKey);
    if (cached) {
        res.status(200).json({ success: true, data: cached });
        return;
    }
    const [jd, embedding] = await Promise.all([
        (0, parseJD_1.parseJD)(jdText),
        (0, embedding_1.generateEmbedding)(jdText),
    ]);
    const actualLimit = limit > 100 ? 100 : limit;
    const rawResults = await (0, searchCandidates_1.searchByEmbedding)(embedding, actualLimit, filters);
    const data = {
        results: [],
        query: jd,
    };
    if (rawResults.length > 0) {
        const semanticScores = new Map();
        const candidates = rawResults.map((r) => {
            semanticScores.set(r.candidate.id, r.score);
            return r.candidate;
        });
        data.results = await (0, finalRanker_1.rankCandidates)(candidates, jd, semanticScores);
    }
    if (explain && data.results.length > 0) {
        try {
            const top5 = data.results.slice(0, 5).map((r) => ({
                id: r.candidate.id,
                name: r.candidate.name,
                skills: r.candidate.skills,
                experience: r.candidate.experience,
                summary: r.candidate.summary,
            }));
            data.explanations = await (0, explainability_1.generateExplanations)(jdText, top5);
        }
        catch (error) {
            logger_1.logger.warn('Failed to generate explanations', { error });
        }
    }
    await (0, cache_1.setCache)(cacheKey, data, 300000);
    res.status(200).json({ success: true, data });
    // Fire-and-forget: save search session
    const searchDurationMs = Date.now() - startTime;
    (0, database_1.saveSearchSession)({
        jobDescriptionText: jdText,
        jdHash,
        filters: filters,
        resultCount: data.results.length,
        searchDurationMs,
        userId: req.userId,
    }).catch(() => { });
});
exports.getCandidateHandler = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const candidates = await (0, retrieveCandidates_1.retrieveCandidateByIds)([id]);
    if (candidates.length === 0) {
        throw new errorHandler_1.AppError('Candidate not found', 404, errorCodes_1.ErrorCodes.NOT_FOUND);
    }
    res.status(200).json({ success: true, data: candidates[0] });
});
exports.batchCandidatesHandler = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { ids } = req.body;
    const candidates = await (0, retrieveCandidates_1.retrieveCandidateByIds)(ids);
    res.status(200).json({ success: true, data: candidates });
});
async function getCandidateJDAndResume(candidateId) {
    const supabase = (0, client_1.getSupabaseClient)();
    const { data: candidateData } = await supabase
        .from('candidates')
        .select('raw_resume_text, upload_session_id')
        .eq('id', candidateId)
        .single();
    let jdText = '';
    const resumeText = candidateData?.raw_resume_text || '';
    if (candidateData?.upload_session_id) {
        const { data: sess } = await supabase
            .from('upload_sessions')
            .select('job_description_text')
            .eq('id', candidateData.upload_session_id)
            .single();
        jdText = sess?.job_description_text || '';
    }
    return { jdText, resumeText };
}
exports.screeningQuestionsHandler = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const candidates = await (0, retrieveCandidates_1.retrieveCandidateByIds)([id]);
    if (candidates.length === 0) {
        throw new errorHandler_1.AppError('Candidate not found', 404, errorCodes_1.ErrorCodes.NOT_FOUND);
    }
    const { jdText, resumeText } = await getCandidateJDAndResume(id);
    const result = await (0, screeningQuestions_1.generateScreeningQuestions)(jdText, resumeText);
    res.status(200).json({ success: true, data: result });
});
exports.closingStrategyHandler = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const candidates = await (0, retrieveCandidates_1.retrieveCandidateByIds)([id]);
    if (candidates.length === 0) {
        throw new errorHandler_1.AppError('Candidate not found', 404, errorCodes_1.ErrorCodes.NOT_FOUND);
    }
    const { jdText, resumeText } = await getCandidateJDAndResume(id);
    const result = await (0, closingStrategy_1.generateClosingStrategy)(jdText, resumeText);
    res.status(200).json({ success: true, data: result });
});
exports.compareCandidatesHandler = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { jdText, candidateIds } = req.body;
    const jd = await (0, parseJD_1.parseJD)(jdText);
    const candidates = await (0, retrieveCandidates_1.retrieveCandidateByIds)(candidateIds);
    if (candidates.length < 2) {
        throw new errorHandler_1.AppError('Could not find all specified candidates', 404, errorCodes_1.ErrorCodes.NOT_FOUND);
    }
    const comparisonText = await (0, compareCandidates_1.compareCandidates)(candidates, jd);
    res.status(200).json({ success: true, data: { comparison: comparisonText, query: jd } });
});
exports.updateCandidateStatusHandler = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const { status, changedBy, details } = req.body;
    if (changedBy || details) {
        await (0, database_1.updateCandidateStatusExtended)(id, status, changedBy, details);
    }
    else {
        await (0, database_1.updateCandidateStatus)(id, status);
    }
    // Fetch candidate for email trigger
    const supabase = (0, client_1.getSupabaseClient)();
    const { data: candidate } = await supabase
        .from('candidates')
        .select('email, full_name')
        .eq('id', id)
        .single();
    if (candidate?.email) {
        if (status === 'Rejected') {
            console.log(`📧 [Rejection] email would be sent to ${candidate.email} (${candidate.full_name || 'Unknown'})`);
        }
        else if (status === 'Offered' || status === 'Offer') {
            console.log(`📧 [Offer] email would be sent to ${candidate.email} (${candidate.full_name || 'Unknown'})`);
        }
    }
    memory_cache_1.memoryCache.delete('dashboard:overview:v2');
    (0, websocket_1.broadcast)('candidate:status_changed', { candidateId: id, status });
    res.status(200).json({ success: true, data: { message: `Candidate status updated to ${status}` } });
});
exports.scheduleInterviewHandler = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const { scheduledDate, scheduledTime, interviewType, interviewerName, notes } = req.body;
    const interview = await (0, database_1.scheduleInterview)(id, {
        scheduledDate,
        scheduledTime,
        interviewType,
        interviewerName,
        notes,
    });
    // Update candidate status to Interview Scheduled
    await (0, database_1.updateCandidateStatusExtended)(id, 'Interview Scheduled', '', {
        interview_id: interview.id,
        interview_type: interviewType,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
    });
    // Log email sent
    const emailBody = `Dear Candidate,\n\nYour interview has been scheduled for ${scheduledDate} at ${scheduledTime}.\n\nInterview Type: ${interviewType}\n\nBest regards,\nRecruitIQ Team`;
    await (0, database_1.logEmail)(id, 'interview_scheduled', 'Interview Scheduled', emailBody);
    memory_cache_1.memoryCache.delete('dashboard:overview:v2');
    (0, websocket_1.broadcast)('candidate:status_changed', { candidateId: id, status: 'Interview Scheduled' });
    (0, websocket_1.broadcast)('interview:scheduled', { candidateId: id, interviewId: interview.id });
    res.status(200).json({ success: true, data: interview });
});
exports.getCandidateInterviewsHandler = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const interviews = await (0, database_1.getCandidateInterviews)(id);
    res.status(200).json({ success: true, data: interviews });
});
exports.updateInterviewHandler = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const interviewId = req.params.interviewId;
    const updateData = req.body;
    await (0, database_1.updateInterview)(interviewId, updateData);
    if (updateData.status === 'completed') {
        const candidateId = req.params.id;
        await (0, database_1.updateCandidateStatusExtended)(candidateId, 'Interview Completed', '', { interview_id: interviewId });
        memory_cache_1.memoryCache.delete('dashboard:overview:v2');
        (0, websocket_1.broadcast)('candidate:status_changed', { candidateId, status: 'Interview Completed' });
    }
    (0, websocket_1.broadcast)('interview:updated', { interviewId });
    res.status(200).json({ success: true, data: { message: 'Interview updated' } });
});
exports.makeOfferHandler = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const { salary, joiningDate, notes } = req.body;
    const offer = await (0, database_1.createOffer)(id, { salary, joiningDate, notes });
    await (0, database_1.updateCandidateStatusExtended)(id, 'Offered', '', {
        offer_id: offer.id,
        salary: salary || null,
        joining_date: joiningDate || null,
    });
    const emailBody = `Dear Candidate,\n\nCongratulations! We are pleased to offer you the position.\n${salary ? `Salary: $${salary}\n` : ''}${joiningDate ? `Joining Date: ${joiningDate}\n` : ''}\n\nBest regards,\nRecruitIQ Team`;
    await (0, database_1.logEmail)(id, 'offer_sent', 'Offer Letter', emailBody);
    memory_cache_1.memoryCache.delete('dashboard:overview:v2');
    (0, websocket_1.broadcast)('candidate:status_changed', { candidateId: id, status: 'Offered' });
    res.status(200).json({ success: true, data: offer });
});
exports.acceptOfferHandler = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    await (0, database_1.acceptOffer)(id);
    await (0, database_1.updateCandidateStatusExtended)(id, 'Hired', '', { accepted_offer: true });
    memory_cache_1.memoryCache.delete('dashboard:overview:v2');
    (0, websocket_1.broadcast)('candidate:status_changed', { candidateId: id, status: 'Hired' });
    res.status(200).json({ success: true, data: { message: 'Candidate marked as hired' } });
});
exports.rejectCandidateHandler = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const { reason, notes, changedBy } = req.body;
    await (0, database_1.rejectCandidateWithReason)(id, reason, notes, changedBy);
    memory_cache_1.memoryCache.delete('dashboard:overview:v2');
    (0, websocket_1.broadcast)('candidate:status_changed', { candidateId: id, status: 'Rejected' });
    res.status(200).json({ success: true, data: { message: 'Candidate rejected' } });
});
exports.generateEmailTemplateHandler = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const supabase = (0, client_1.getSupabaseClient)();
    const { data: candidate } = await supabase
        .from('candidates')
        .select('full_name, parsed_json, upload_session_id')
        .eq('id', id)
        .single();
    if (!candidate) {
        throw new errorHandler_1.AppError('Candidate not found', 404, errorCodes_1.ErrorCodes.NOT_FOUND);
    }
    let jobTitle = 'the position';
    if (candidate.upload_session_id) {
        const { data: session } = await supabase
            .from('upload_sessions')
            .select('job_description_text')
            .eq('id', candidate.upload_session_id)
            .single();
        if (session?.job_description_text) {
            const firstLine = session.job_description_text.split('\n')[0].trim();
            if (firstLine)
                jobTitle = firstLine;
        }
    }
    const parsedJson = candidate.parsed_json;
    const candidateInfo = parsedJson?.summary
        ? `Summary: ${parsedJson.summary}`
        : `Skills: ${(parsedJson?.skills || []).join(', ')}`;
    const emailBody = await (0, emailTemplate_1.generateInterviewEmail)(candidate.full_name || 'Candidate', jobTitle, candidateInfo);
    const subject = `Interview Invitation: ${jobTitle}`;
    res.status(200).json({ success: true, data: { subject, body: emailBody } });
});
exports.sendInterviewEmailHandler = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const { interviewId, subject, body } = req.body;
    // Fetch interview details for email generation
    const interviews = await (0, database_1.getCandidateInterviews)(id);
    const interview = interviewId
        ? interviews.find((i) => i.id === interviewId)
        : interviews[0];
    if (!interview) {
        throw new errorHandler_1.AppError('No interview found for this candidate', 404, errorCodes_1.ErrorCodes.NOT_FOUND);
    }
    const emailSubject = subject || 'Interview Confirmation';
    const emailBody = body || `Dear Candidate,\n\nYour interview has been confirmed.\n\nDate: ${interview.scheduled_date}\nTime: ${interview.scheduled_time}\nType: ${interview.interview_type}\n${interview.meeting_link ? `Link: ${interview.meeting_link}\n` : ''}\n\nBest regards,\nRecruitIQ Team`;
    await (0, database_1.logEmail)(id, 'interview_email', emailSubject, emailBody);
    res.status(200).json({ success: true, data: { message: 'Interview email sent', subject: emailSubject, body: emailBody } });
});
exports.getCandidateTimelineHandler = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const timeline = await (0, database_1.getCandidateTimeline)(id);
    res.status(200).json({ success: true, data: timeline });
});
exports.addCandidateNoteHandler = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const { noteText } = req.body;
    await (0, database_1.addCandidateNote)(id, noteText.trim());
    (0, websocket_1.broadcast)('candidate:note_added', { candidateId: id });
    res.status(200).json({ success: true, data: { message: 'Note added' } });
});
exports.getCandidateNotesHandler = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const notes = await (0, database_1.getCandidateNotes)(id);
    res.status(200).json({ success: true, data: notes });
});
exports.getSimilarCandidatesHandler = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const candidates = await (0, retrieveCandidates_1.retrieveCandidateByIds)([id]);
    if (candidates.length === 0) {
        throw new errorHandler_1.AppError('Candidate not found', 404, errorCodes_1.ErrorCodes.NOT_FOUND);
    }
    const candidate = candidates[0];
    const embeddingText = `${candidate.name} Skills: ${candidate.skills.join(', ')}`;
    const embedding = await (0, embedding_1.generateEmbedding)(embeddingText);
    const similar = await (0, searchCandidates_1.searchByEmbedding)(embedding, 10, {});
    const filtered = similar.filter((r) => r.candidate.id !== id);
    res.status(200).json({ success: true, data: filtered.slice(0, 5).map((r) => r.candidate) });
});
exports.getAllCandidatesHandler = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { page = '1', limit = '20', search, sortBy, sortOrder, sessionId, status, } = req.query;
    // For "interviews-today", resolve candidate IDs first
    let interviewCandidateIds;
    if (status === 'interviews-today') {
        const supabase = (0, client_1.getSupabaseClient)();
        const todayStr = new Date().toISOString().split('T')[0];
        let intQuery = supabase
            .from('interviews')
            .select('candidate_id')
            .eq('scheduled_date', todayStr)
            .eq('status', 'scheduled');
        if (sessionId) {
            const { data: sessCandidates } = await supabase
                .from('candidates')
                .select('id')
                .eq('upload_session_id', sessionId);
            const ids = (sessCandidates || []).map((c) => c.id);
            if (ids.length > 0) {
                intQuery = intQuery.in('candidate_id', ids);
            }
        }
        const { data: intData } = await intQuery;
        interviewCandidateIds = [...new Set((intData || []).map((r) => r.candidate_id))];
    }
    const result = await (0, database_1.getAllCandidatesPaginated)({
        page: parseInt(page || '1', 10),
        limit: parseInt(limit || '20', 10),
        search,
        sortBy,
        sortOrder: sortOrder || 'desc',
        sessionId,
        status,
        interviewCandidateIds,
    });
    res.status(200).json({ success: true, data: result });
});
//# sourceMappingURL=candidateController.js.map