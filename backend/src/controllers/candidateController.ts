import crypto from 'crypto';
import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { parseJD } from '@/services/llm/parseJD';
import { generateEmbedding } from '@/services/embedding';
import { searchByEmbedding } from '@/services/qdrant/searchCandidates';
import { retrieveCandidateByIds } from '@/services/qdrant/retrieveCandidates';
import { rankCandidates } from '@/services/ranking/finalRanker';
import { compareCandidates } from '@/services/llm/compareCandidates';
import { generateScreeningQuestions } from '@/services/llm/screeningQuestions';
import { generateClosingStrategy } from '@/services/llm/closingStrategy';
import { getSupabaseClient } from '@/services/supabase/client';
import {
  updateCandidateStatus,
  updateCandidateStatusExtended,
  addCandidateNote,
  getCandidateNotes,
  saveSearchSession,
  getAllCandidatesPaginated,
  scheduleInterview,
  getCandidateInterviews,
  updateInterview,
  createOffer,
  acceptOffer,
  rejectCandidateWithReason,
  getCandidateTimeline,
  logEmail,
} from '@/services/supabase/database';
import { Candidate } from '@/types';
import { logger } from '@/utils/logger';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import { getCached, setCache } from '@/utils/cache';
import { generateExplanations } from '@/services/llm/explainability';
import { generateInterviewEmail } from '@/services/llm/emailTemplate';
import { broadcast } from '@/services/websocket';

export const searchCandidatesHandler = asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { jdText, limit = 20, filters, explain = false } = req.body;

  const jdHash = crypto.createHash('md5').update(jdText).digest('hex');
  const cacheKey = `search:${jdHash}:${limit}:${JSON.stringify(filters ?? {})}:${explain}`;
  const cached = await getCached<{ results: import('@/types').RankingResult[]; query: import('@/types').ParsedJD; explanations?: Record<string, unknown> }>(cacheKey);
  if (cached) {
    res.status(200).json({ success: true, data: cached });
    return;
  }

  const [jd, embedding] = await Promise.all([
    parseJD(jdText),
    generateEmbedding(jdText),
  ]);

  const actualLimit = limit > 100 ? 100 : limit;
  const rawResults = await searchByEmbedding(embedding, actualLimit, filters);

  const data: { results: import('@/types').RankingResult[]; query: import('@/types').ParsedJD; explanations?: Record<string, unknown> } = {
    results: [],
    query: jd,
  };

  if (rawResults.length > 0) {
    const semanticScores = new Map<string, number>();
    const candidates: Candidate[] = rawResults.map((r) => {
      semanticScores.set(r.candidate.id, r.score);
      return r.candidate;
    });

    data.results = await rankCandidates(candidates, jd, semanticScores);
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
      data.explanations = await generateExplanations(jdText, top5);
    } catch (error) {
      logger.warn('Failed to generate explanations', { error });
    }
  }

  await setCache(cacheKey, data, 300000);
  res.status(200).json({ success: true, data });

  // Fire-and-forget: save search session
  const searchDurationMs = Date.now() - startTime;
  saveSearchSession({
    jobDescriptionText: jdText,
    jdHash,
    filters: filters as Record<string, unknown> | undefined,
    resultCount: data.results.length,
    searchDurationMs,
    userId: (req as any).userId,
  }).catch(() => {});
});

export const getCandidateHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const candidates = await retrieveCandidateByIds([id]);
  if (candidates.length === 0) {
    throw new AppError('Candidate not found', 404, ErrorCodes.NOT_FOUND);
  }

  res.status(200).json({ success: true, data: candidates[0] });
});

export const batchCandidatesHandler = asyncHandler(async (req: Request, res: Response) => {
  const { ids } = req.body;

  const candidates = await retrieveCandidateByIds(ids);
  res.status(200).json({ success: true, data: candidates });
});

async function getCandidateJDAndResume(candidateId: string): Promise<{ jdText: string; resumeText: string }> {
  const supabase = getSupabaseClient();
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

export const screeningQuestionsHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const candidates = await retrieveCandidateByIds([id]);
  if (candidates.length === 0) {
    throw new AppError('Candidate not found', 404, ErrorCodes.NOT_FOUND);
  }

  const { jdText, resumeText } = await getCandidateJDAndResume(id);
  const result = await generateScreeningQuestions(jdText, resumeText);
  res.status(200).json({ success: true, data: result });
});

export const closingStrategyHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const candidates = await retrieveCandidateByIds([id]);
  if (candidates.length === 0) {
    throw new AppError('Candidate not found', 404, ErrorCodes.NOT_FOUND);
  }

  const { jdText, resumeText } = await getCandidateJDAndResume(id);
  const result = await generateClosingStrategy(jdText, resumeText);
  res.status(200).json({ success: true, data: result });
});

export const compareCandidatesHandler = asyncHandler(async (req: Request, res: Response) => {
  const { jdText, candidateIds } = req.body;

  const jd = await parseJD(jdText);
  const candidates = await retrieveCandidateByIds(candidateIds);

  if (candidates.length < 2) {
    throw new AppError('Could not find all specified candidates', 404, ErrorCodes.NOT_FOUND);
  }

  const comparisonText = await compareCandidates(candidates, jd);
  res.status(200).json({ success: true, data: { comparison: comparisonText, query: jd } });
});

export const updateCandidateStatusHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { status, changedBy, details } = req.body;

  if (changedBy || details) {
    await updateCandidateStatusExtended(id, status, changedBy, details);
  } else {
    await updateCandidateStatus(id, status);
  }

  // Fetch candidate for email trigger
  const supabase = getSupabaseClient();
  const { data: candidate } = await supabase
    .from('candidates')
    .select('email, full_name')
    .eq('id', id)
    .single();

  if (candidate?.email) {
    if (status === 'Rejected') {
      console.log(`📧 [Rejection] email would be sent to ${candidate.email} (${candidate.full_name || 'Unknown'})`);
    } else if (status === 'Offered' || status === 'Offer') {
      console.log(`📧 [Offer] email would be sent to ${candidate.email} (${candidate.full_name || 'Unknown'})`);
    }
  }

  broadcast('candidate:status_changed', { candidateId: id, status });
  res.status(200).json({ success: true, data: { message: `Candidate status updated to ${status}` } });
});

export const scheduleInterviewHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { scheduledDate, scheduledTime, interviewType, interviewerName, notes } = req.body;

  const interview = await scheduleInterview(id, {
    scheduledDate,
    scheduledTime,
    interviewType,
    interviewerName,
    notes,
  });

  // Update candidate status to Interview Scheduled
  await updateCandidateStatusExtended(id, 'Interview Scheduled', '', {
    interview_id: interview.id,
    interview_type: interviewType,
    scheduled_date: scheduledDate,
    scheduled_time: scheduledTime,
  });

  // Log email sent
  const emailBody = `Dear Candidate,\n\nYour interview has been scheduled for ${scheduledDate} at ${scheduledTime}.\n\nInterview Type: ${interviewType}\n\nBest regards,\nRecruitIQ Team`;
  await logEmail(id, 'interview_scheduled', 'Interview Scheduled', emailBody);

  broadcast('candidate:status_changed', { candidateId: id, status: 'Interview Scheduled' });
  broadcast('interview:scheduled', { candidateId: id, interviewId: interview.id });

  res.status(200).json({ success: true, data: interview });
});

export const getCandidateInterviewsHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const interviews = await getCandidateInterviews(id);
  res.status(200).json({ success: true, data: interviews });
});

export const updateInterviewHandler = asyncHandler(async (req: Request, res: Response) => {
  const interviewId = req.params.interviewId as string;
  const updateData = req.body;

  await updateInterview(interviewId, updateData);

  if (updateData.status === 'completed') {
    const candidateId = req.params.id as string;
    await updateCandidateStatusExtended(candidateId, 'Interview Completed', '', { interview_id: interviewId });
    broadcast('candidate:status_changed', { candidateId, status: 'Interview Completed' });
  }

  broadcast('interview:updated', { interviewId });
  res.status(200).json({ success: true, data: { message: 'Interview updated' } });
});

export const makeOfferHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { salary, joiningDate, notes } = req.body;

  const offer = await createOffer(id, { salary, joiningDate, notes });
  await updateCandidateStatusExtended(id, 'Offered', '', {
    offer_id: offer.id,
    salary: salary || null,
    joining_date: joiningDate || null,
  });

  const emailBody = `Dear Candidate,\n\nCongratulations! We are pleased to offer you the position.\n${salary ? `Salary: $${salary}\n` : ''}${joiningDate ? `Joining Date: ${joiningDate}\n` : ''}\n\nBest regards,\nRecruitIQ Team`;
  await logEmail(id, 'offer_sent', 'Offer Letter', emailBody);

  broadcast('candidate:status_changed', { candidateId: id, status: 'Offered' });
  res.status(200).json({ success: true, data: offer });
});

export const acceptOfferHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  await acceptOffer(id);
  await updateCandidateStatusExtended(id, 'Hired', '', { accepted_offer: true });

  broadcast('candidate:status_changed', { candidateId: id, status: 'Hired' });
  res.status(200).json({ success: true, data: { message: 'Candidate marked as hired' } });
});

export const rejectCandidateHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { reason, notes, changedBy } = req.body;

  await rejectCandidateWithReason(id, reason, notes, changedBy);

  broadcast('candidate:status_changed', { candidateId: id, status: 'Rejected' });
  res.status(200).json({ success: true, data: { message: 'Candidate rejected' } });
});

export const generateEmailTemplateHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const supabase = getSupabaseClient();
  const { data: candidate } = await supabase
    .from('candidates')
    .select('full_name, parsed_json, upload_session_id')
    .eq('id', id)
    .single();

  if (!candidate) {
    throw new AppError('Candidate not found', 404, ErrorCodes.NOT_FOUND);
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
      if (firstLine) jobTitle = firstLine;
    }
  }

  const parsedJson = candidate.parsed_json as Record<string, unknown> | null;
  const candidateInfo = parsedJson?.summary
    ? `Summary: ${parsedJson.summary}`
    : `Skills: ${(parsedJson?.skills as string[] || []).join(', ')}`;

  const emailBody = await generateInterviewEmail(
    candidate.full_name || 'Candidate',
    jobTitle,
    candidateInfo,
  );

  const subject = `Interview Invitation: ${jobTitle}`;

  res.status(200).json({ success: true, data: { subject, body: emailBody } });
});

export const sendInterviewEmailHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { interviewId, subject, body } = req.body;

  // Fetch interview details for email generation
  const interviews = await getCandidateInterviews(id);
  const interview = interviewId
    ? interviews.find((i) => i.id === interviewId)
    : interviews[0];

  if (!interview) {
    throw new AppError('No interview found for this candidate', 404, ErrorCodes.NOT_FOUND);
  }

  const emailSubject = subject || 'Interview Confirmation';
  const emailBody = body || `Dear Candidate,\n\nYour interview has been confirmed.\n\nDate: ${interview.scheduled_date}\nTime: ${interview.scheduled_time}\nType: ${interview.interview_type}\n${interview.meeting_link ? `Link: ${interview.meeting_link}\n` : ''}\n\nBest regards,\nRecruitIQ Team`;

  await logEmail(id, 'interview_email', emailSubject, emailBody);

  res.status(200).json({ success: true, data: { message: 'Interview email sent', subject: emailSubject, body: emailBody } });
});

export const getCandidateTimelineHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const timeline = await getCandidateTimeline(id);
  res.status(200).json({ success: true, data: timeline });
});

export const addCandidateNoteHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { noteText } = req.body;

  await addCandidateNote(id, noteText.trim());
  broadcast('candidate:note_added', { candidateId: id });
  res.status(200).json({ success: true, data: { message: 'Note added' } });
});

export const getCandidateNotesHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const notes = await getCandidateNotes(id);
  res.status(200).json({ success: true, data: notes });
});

export const getSimilarCandidatesHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const candidates = await retrieveCandidateByIds([id]);
  if (candidates.length === 0) {
    throw new AppError('Candidate not found', 404, ErrorCodes.NOT_FOUND);
  }

  const candidate = candidates[0];
  const embeddingText = `${candidate.name} Skills: ${candidate.skills.join(', ')}`;
  const embedding = await generateEmbedding(embeddingText);

  const similar = await searchByEmbedding(embedding, 10, {});
  const filtered = similar.filter((r) => r.candidate.id !== id);

  res.status(200).json({ success: true, data: filtered.slice(0, 5).map((r) => r.candidate) });
});

export const getAllCandidatesHandler = asyncHandler(async (req: Request, res: Response) => {
  const {
    page = '1',
    limit = '20',
    search,
    sortBy,
    sortOrder,
    sessionId,
    status,
  } = req.query as Record<string, string | undefined>;

  // For "interviews-today", resolve candidate IDs first
  let interviewCandidateIds: string[] | undefined;
  if (status === 'interviews-today') {
    const supabase = getSupabaseClient();
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
      const ids = (sessCandidates || []).map((c: any) => c.id);
      if (ids.length > 0) {
        intQuery = intQuery.in('candidate_id', ids);
      }
    }
    const { data: intData } = await intQuery;
    interviewCandidateIds = [...new Set((intData || []).map((r: any) => r.candidate_id))];
  }

  const result = await getAllCandidatesPaginated({
    page: parseInt(page || '1', 10),
    limit: parseInt(limit || '20', 10),
    search,
    sortBy,
    sortOrder: (sortOrder as 'asc' | 'desc') || 'desc',
    sessionId,
    status,
    interviewCandidateIds,
  });

  res.status(200).json({ success: true, data: result });
});