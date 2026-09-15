import crypto from 'crypto';
import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { parseJD } from '@/services/llm/parseJD';
import { generateEmbedding } from '@/services/embedding';
import { searchByEmbedding } from '@/services/qdrant/searchCandidates';
import { retrieveCandidateByIds, retrieveCandidateVector } from '@/services/qdrant/retrieveCandidates';
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
import { Candidate, CompareResult } from '@/types';
import { logger } from '@/utils/logger';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import { CANDIDATE_STATUS } from '@/constants/candidateStatus';
import { getCached, setCache } from '@/utils/cache';
import { invalidateDashboardCache } from '@/controllers/dashboardController';
import { generateExplanations } from '@/services/llm/explainability';
import { generateInterviewEmail } from '@/services/llm/emailTemplate';
import { generateOutreachEmail } from '@/services/llm/outreachEmail';
import { isGmailConfigured } from '@/services/gmail/oauth';
import { isValidEmail, sendGmailMessage } from '@/services/gmail/send';
import {
  getRecruiterGmailState,
  getRecruiterGmailRefreshToken,
} from '@/services/supabase/database';
import { broadcast } from '@/services/websocket';
import { logActivity } from '@/services/activity';
import { enqueueEmail } from '@/services/queue/emailQueue';

async function invalidateDashboard(req: Request): Promise<void> {
  const recruiterId = req.recruiter?.id;
  if (recruiterId) await invalidateDashboardCache(recruiterId);
}
import { buildRejectionEmail, buildOfferEmail, buildInterviewEmailHtml } from '@/services/email';

export const searchCandidatesHandler = asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { jdText, limit = 20, page = 1, filters, explain = false } = req.body;

  const jdHash = crypto.createHash('md5').update(jdText).digest('hex');
  const cacheKey = `search:${jdHash}:${limit}:${page}:${JSON.stringify(filters ?? {})}:${explain}`;
  const cached = await getCached<{ results: import('@/types').RankingResult[]; query: import('@/types').ParsedJD; explanations?: Record<string, unknown>; total: number; page: number; totalPages: number }>(cacheKey);
  if (cached) {
    res.status(200).json({ success: true, data: cached });
    return;
  }

  const [jd, embedding] = await Promise.all([
    parseJD(jdText),
    generateEmbedding(jdText),
  ]);

  const actualLimit = limit > 100 ? 100 : limit;
  const qdrantLimit = actualLimit + 20;
  const offset = (page - 1) * actualLimit;
  const rawResults = await searchByEmbedding(embedding, qdrantLimit, filters, offset);

  const total = rawResults.length;
  const totalPages = Math.max(1, Math.ceil(total / actualLimit));

  const data: { results: import('@/types').RankingResult[]; query: import('@/types').ParsedJD; explanations?: Record<string, unknown>; total: number; page: number; totalPages: number } = {
    results: [],
    query: jd,
    total,
    page,
    totalPages,
  };

  if (rawResults.length > 0) {
    const semanticScores = new Map<string, number>();
    const candidates: Candidate[] = rawResults.map((r) => {
      semanticScores.set(r.candidate.id, r.score);
      return r.candidate;
    });

    const ranked = await rankCandidates(candidates, jd, semanticScores);
    data.results = ranked.slice(0, actualLimit);
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

  // Fire-and-forget: save search session + log activity
  const r6 = req.recruiter;
  if (r6) {
    logActivity({
      recruiterId: r6.id,
      actionType: 'search_executed',
      description: `Search executed — ${jd.title || jdText.slice(0, 60)}${jdText.length > 60 ? '...' : ''} (${data.results.length} results)`,
    });
  }
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

  const r7 = req.recruiter;
  if (r7 && candidates.length > 0) {
    logActivity({
      recruiterId: r7.id,
      actionType: 'candidate_viewed',
      description: `Candidate viewed: ${candidates[0].name}`,
      candidateId: id,
    });
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

function compareCacheKey(jdText: string, candidateIds: string[]): string {
  const jdHash = crypto.createHash('md5').update(jdText).digest('hex');
  const ids = [...candidateIds].sort().join(',');
  return `compare:${jdHash}:${ids}`;
}

export const compareCandidatesHandler = asyncHandler(async (req: Request, res: Response) => {
  const { jdText, candidateIds } = req.body;
  const t0 = Date.now();

  const cacheKey = compareCacheKey(jdText, candidateIds);
  const cached = await getCached<CompareResult>(cacheKey);
  if (cached) {
    res.status(200).json({ success: true, data: { comparison: cached, query: null, cached: true } });
    logger.info('Compare lifecycle: cache hit', { cacheKey, totalMs: Date.now() - t0 });
    return;
  }

  const t1 = Date.now();
  const jd = await parseJD(jdText);
  logger.info('Compare lifecycle: parseJD done', { ms: Date.now() - t1 });

  const t2 = Date.now();
  const candidates = await retrieveCandidateByIds(candidateIds);
  logger.info('Compare lifecycle: retrieveCandidates done', { ms: Date.now() - t2, count: candidates.length });

  if (candidates.length < 2) {
    throw new AppError('Could not find all specified candidates', 404, ErrorCodes.NOT_FOUND);
  }

  const t3 = Date.now();
  const comparison = await compareCandidates(candidates, jd, jdText);
  logger.info('Compare lifecycle: compareCandidates done', {
    ms: Date.now() - t3,
    candidateCount: comparison.candidates.length,
    recommendedId: comparison.recommendation.candidateId,
  });

  // Enrich comparison with candidate profile metadata (name, title, company, location) from DB
  const supabase = getSupabaseClient();
  const { data: records } = await supabase
    .from('candidates')
    .select('id, full_name, current_title, current_company, location')
    .in('id', candidateIds);

  const recordMap = new Map<string, { full_name?: string; current_title?: string; current_company?: string; location?: string }>();
  if (records) {
    for (const r of records as Array<{ id: string; full_name?: string; current_title?: string; current_company?: string; location?: string }>) {
      recordMap.set(r.id, r);
    }
  }

  for (const c of comparison.candidates) {
    const record = recordMap.get(c.candidateId);
    if (record) {
      c.name = record.full_name || c.name;
      c.title = record.current_title || '';
      c.company = record.current_company || '';
      c.location = record.location || '';
    }
  }

  // Strip markdown from LLM-generated text
  const stripMarkdown = (text: string) =>
    text
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/>\s+/g, '')
      .replace(/[-*+]\s+/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

  comparison.summary = stripMarkdown(comparison.summary);
  for (const c of comparison.candidates) {
    c.verdict = stripMarkdown(c.verdict);
    c.strengths = c.strengths.map(stripMarkdown);
    c.weaknesses = c.weaknesses.map(stripMarkdown);
    c.risks = c.risks.map(stripMarkdown);
  }
  comparison.interviewQuestions = comparison.interviewQuestions.map(stripMarkdown);
  comparison.recommendation.reasoning = stripMarkdown(comparison.recommendation.reasoning);

  const t4 = Date.now();
  const body = { success: true, data: { comparison, query: jd } };
  res.status(200).json(body);

  logger.info('Compare lifecycle: response sent', { totalMs: Date.now() - t0 });

  // Fire-and-forget: log activity
  const r = req.recruiter;
  if (r) {
    const nameList = comparison.candidates.map(c => c.name).join(', ');
    logActivity({
      recruiterId: r.id,
      actionType: 'candidate_compared',
      description: `Compared ${comparison.candidates.length} candidates: ${nameList}`,
      metadata: {
        candidateIds,
        recommendedId: comparison.recommendation.candidateId,
        jdTitle: jd.title,
      },
    });
  }
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
    if (status === CANDIDATE_STATUS.REJECTED) {
      enqueueEmail({
        to: candidate.email,
        subject: 'Application Update',
        html: buildRejectionEmail(candidate.full_name || 'Candidate'),
      });
    } else if (status === CANDIDATE_STATUS.OFFERED) {
      const salary = (req.body as any).details?.salary;
      const joiningDate = (req.body as any).details?.joining_date;
      enqueueEmail({
        to: candidate.email,
        subject: 'Congratulations — Offer Letter',
        html: buildOfferEmail(candidate.full_name || 'Candidate', salary, joiningDate),
      });
    }
  }

  await invalidateDashboard(req);
  broadcast('candidate:status_changed', { candidateId: id, status });
  const r = req.recruiter;
  if (r) {
    logActivity({
      recruiterId: r.id,
      actionType: 'status_changed',
      description: `Status changed to ${status}`,
      candidateId: id,
    });
  }
  res.status(200).json({ success: true, data: { message: `Candidate status updated to ${status}` } });
});

export const scheduleInterviewHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { scheduledDate, scheduledTime, interviewType, interviewerName, notes } = req.body;

  // Scheduling is forward-looking — a past date would create an interview
  // that is immediately overdue/invisible as upcoming. Reject it at the API
  // boundary (the UI also clamps the date picker to today).
  if (typeof scheduledDate !== 'string' || scheduledDate.slice(0, 10) < new Date().toISOString().split('T')[0]) {
    res.status(400).json({ success: false, error: 'Interview date cannot be in the past' });
    return;
  }

  const interview = await scheduleInterview(id, {
    scheduledDate,
    scheduledTime,
    interviewType,
    interviewerName,
    notes,
  });

  // Update candidate status to Interview Scheduled
  await updateCandidateStatusExtended(id, CANDIDATE_STATUS.INTERVIEW_SCHEDULED, '', {
    interview_id: interview.id,
    interview_type: interviewType,
    scheduled_date: scheduledDate,
    scheduled_time: scheduledTime,
  });

  // Send interview email
  const interviewEmailHtml = buildInterviewEmailHtml('Candidate', '', scheduledDate, scheduledTime, interviewType, interview.meeting_link);
  await logEmail(id, 'interview_scheduled', 'Interview Scheduled', interviewEmailHtml);
  const supabase2 = getSupabaseClient();
  const { data: candidate2 } = await supabase2
    .from('candidates')
    .select('email, full_name')
    .eq('id', id)
    .single();
  if (candidate2?.email) {
    const { generateInterviewEmail } = await import('@/services/llm/emailTemplate');
    const emailBody2 = await generateInterviewEmail(candidate2.full_name || 'Candidate', 'the position', '');
    enqueueEmail({
      to: candidate2.email,
      subject: 'Interview Scheduled',
      html: emailBody2,
    });
  }

  await invalidateDashboard(req);
  broadcast('candidate:status_changed', { candidateId: id, status: CANDIDATE_STATUS.INTERVIEW_SCHEDULED });
  broadcast('interview:scheduled', { candidateId: id, interviewId: interview.id });
  const r1 = req.recruiter;
  if (r1) {
    logActivity({
      recruiterId: r1.id,
      actionType: 'interview_scheduled',
      description: `Interview scheduled (${interviewType})`,
      candidateId: id,
    });
  }

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

  // Same guard as scheduling — rescheduling into the past is not allowed.
  if (typeof updateData.scheduledDate === 'string' && updateData.scheduledDate.slice(0, 10) < new Date().toISOString().split('T')[0]) {
    res.status(400).json({ success: false, error: 'Interview date cannot be in the past' });
    return;
  }

  await updateInterview(interviewId, updateData);

  // Any interview change (reschedule, cancel, complete) affects the dashboard
  // upcoming list, so the cached dashboard must be invalidated every time —
  // not only on completion — otherwise the widget serves stale empty data.
  await invalidateDashboard(req);

  if (updateData.status === 'completed') {
    const candidateId = req.params.id as string;
    await updateCandidateStatusExtended(candidateId, CANDIDATE_STATUS.INTERVIEW_COMPLETED, '', { interview_id: interviewId });
    broadcast('candidate:status_changed', { candidateId, status: CANDIDATE_STATUS.INTERVIEW_COMPLETED });
  }

  broadcast('interview:updated', { interviewId });
  res.status(200).json({ success: true, data: { message: 'Interview updated' } });
});

export const makeOfferHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { salary, joiningDate, notes } = req.body;

  const offer = await createOffer(id, { salary, joiningDate, notes });
  await updateCandidateStatusExtended(id, CANDIDATE_STATUS.OFFERED, '', {
    offer_id: offer.id,
    salary: salary || null,
    joining_date: joiningDate || null,
  });

  const emailBody = `Dear Candidate,\n\nCongratulations! We are pleased to offer you the position.\n${salary ? `Salary: $${salary}\n` : ''}${joiningDate ? `Joining Date: ${joiningDate}\n` : ''}\n\nBest regards,\nHireStack Team`;
  await logEmail(id, 'offer_sent', 'Offer Letter', emailBody);

  await invalidateDashboard(req);
  broadcast('candidate:status_changed', { candidateId: id, status: CANDIDATE_STATUS.OFFERED });
  const r2 = req.recruiter;
  if (r2) {
    logActivity({
      recruiterId: r2.id,
      actionType: 'offer_generated',
      description: `Offer generated${salary ? ` ($${salary})` : ''}`,
      candidateId: id,
    });
  }
  res.status(200).json({ success: true, data: offer });
});

export const acceptOfferHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  await acceptOffer(id);
  await updateCandidateStatusExtended(id, CANDIDATE_STATUS.HIRED, '', { accepted_offer: true });

  await invalidateDashboard(req);
  broadcast('candidate:status_changed', { candidateId: id, status: CANDIDATE_STATUS.HIRED });
  res.status(200).json({ success: true, data: { message: 'Candidate marked as hired' } });
});

export const rejectCandidateHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { reason, notes, changedBy } = req.body;

  await rejectCandidateWithReason(id, reason, notes, changedBy);

  await invalidateDashboard(req);
  broadcast('candidate:status_changed', { candidateId: id, status: CANDIDATE_STATUS.REJECTED });
  const r3 = req.recruiter;
  if (r3) {
    logActivity({
      recruiterId: r3.id,
      actionType: 'status_changed',
      description: `Candidate rejected: ${reason}`,
      candidateId: id,
    });
  }
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
  const emailBody = body || `Dear Candidate,\n\nYour interview has been confirmed.\n\nDate: ${interview.scheduled_date}\nTime: ${interview.scheduled_time}\nType: ${interview.interview_type}\n${interview.meeting_link ? `Link: ${interview.meeting_link}\n` : ''}\n\nBest regards,\nHireStack Team`;

  await logEmail(id, 'interview_email', emailSubject, emailBody);

  const r4 = req.recruiter;
  if (r4) {
    logActivity({
      recruiterId: r4.id,
      actionType: 'email_sent',
      description: `Email sent: ${emailSubject}`,
      candidateId: id,
    });
  }

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
  const r5 = req.recruiter;
  if (r5) {
    logActivity({
      recruiterId: r5.id,
      actionType: 'note_added',
      description: `Note added`,
      candidateId: id,
    });
  }
  res.status(201).json({ success: true, data: { message: 'Note added' } });
});

export const getCandidateNotesHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const notes = await getCandidateNotes(id);
  res.status(200).json({ success: true, data: notes });
});

export const getCandidateBriefHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const [candidates, supabaseData] = await Promise.all([
    retrieveCandidateByIds([id]),
    getSupabaseClient().from('candidates').select('*').eq('id', id).single(),
  ]);

  if (candidates.length === 0) {
    throw new AppError('Candidate not found', 404, ErrorCodes.NOT_FOUND);
  }

  const candidate = candidates[0];
  const record = supabaseData.data as Record<string, unknown> | null;

  const [notes, timeline, similarCandidates] = await Promise.all([
    getCandidateNotes(id),
    getCandidateTimeline(id),
    (async () => {
      // Reuse the candidate's stored Qdrant vector — no embedding inference.
      // Falls back to generateEmbedding() only when the vector is missing.
      const stored = await retrieveCandidateVector(id);
      const embedding =
        stored ??
        (await generateEmbedding(`${candidate.name} Skills: ${candidate.skills.join(', ')}`));
      const similar = await searchByEmbedding(embedding, 10, {});
      return similar.filter((r) => r.candidate.id !== id).slice(0, 5).map((r) => r.candidate);
    })(),
  ]);

  const candidateRecord = {
    fullName: (record?.full_name as string) || undefined,
    email: (record?.email as string) || undefined,
    phone: (record?.phone as string) || undefined,
    location: (record?.location as string) || undefined,
    currentCompany: (record?.current_company as string) || undefined,
    currentTitle: (record?.current_title as string) || undefined,
    totalExperienceYears: (record?.total_experience_years as number) || undefined,
    rawResumeText: (record?.raw_resume_text as string) || undefined,
    resumeFileUrl: (record?.resume_file_url as string) || undefined,
    flightRisk: (record?.flight_risk as string) || undefined,
    growthTrajectory: (record?.growth_trajectory as string) || undefined,
    currentStatus: (record?.current_status as string) || undefined,
    createdAt: (record?.created_at as string) || undefined,
  };

  const parsedJson = record?.parsed_json as Record<string, unknown> | null;

  const brief: import('@/types').CandidateBrief = {
    candidate,
    record: candidateRecord,
    parsedResume: parsedJson,
    notes,
    timeline,
    similarCandidates,
    scores: null,
  };

  res.status(200).json({ success: true, data: brief });
});

export const getSimilarCandidatesHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const candidates = await retrieveCandidateByIds([id]);
  if (candidates.length === 0) {
    throw new AppError('Candidate not found', 404, ErrorCodes.NOT_FOUND);
  }

  const candidate = candidates[0];
  // Reuse the candidate's stored Qdrant vector — no embedding inference.
  // Falls back to generateEmbedding() only when the vector is missing.
  const stored = await retrieveCandidateVector(id);
  const embedding =
    stored ??
    (await generateEmbedding(`${candidate.name} Skills: ${candidate.skills.join(', ')}`));

  const similar = await searchByEmbedding(embedding, 10, {});
  const filtered = similar.filter((r) => r.candidate.id !== id);

  res.status(200).json({ success: true, data: filtered.slice(0, 5).map((r) => r.candidate) });
});

export const getAllCandidatesHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiter = req.recruiter;
  const recruiterId = recruiter?.id;

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
    recruiterId,
  });

  res.status(200).json({ success: true, data: result });
});

// === GMAIL OUTREACH (new — existing interview email flow untouched) ===

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

export const generateOutreachEmailHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const recruiter = req.recruiter;

  const [candidates, supabaseData] = await Promise.all([
    retrieveCandidateByIds([id]),
    getSupabaseClient().from('candidates').select('full_name, email, current_title, current_company, total_experience_years, parsed_json, upload_session_id').eq('id', id).single(),
  ]);

  if (candidates.length === 0 || !supabaseData.data) {
    throw new AppError('Candidate not found', 404, ErrorCodes.NOT_FOUND);
  }

  const candidate = candidates[0];
  const record = supabaseData.data as Record<string, unknown>;
  const parsed = (record.parsed_json as Record<string, unknown> | null) || {};

  const candidateEmail = String(record.email || candidate.email || '');
  const candidateName = String(record.full_name || candidate.name || 'Candidate');

  let jobDescription = '';
  let targetRole = String(record.current_title || '');
  if (record.upload_session_id) {
    const { data: session } = await getSupabaseClient()
      .from('upload_sessions')
      .select('job_description_text')
      .eq('id', String(record.upload_session_id))
      .single();
    jobDescription = String((session as { job_description_text?: string } | null)?.job_description_text || '');
    if (!targetRole) {
      const firstLine = jobDescription.split('\n')[0]?.trim() || '';
      targetRole = firstLine.slice(0, 120) || 'the position';
    }
  }
  if (!targetRole) targetRole = 'the position';

  let companyName: string | undefined;
  let recruiterName: string | undefined;
  if (recruiter?.id) {
    const { data: rec } = await getSupabaseClient()
      .from('recruiters')
      .select('organization_name, first_name, last_name')
      .eq('id', recruiter.id)
      .maybeSingle();
    const row = rec as { organization_name?: string | null; first_name?: string | null; last_name?: string | null } | null;
    companyName = row?.organization_name || undefined;
    const full = `${row?.first_name || ''} ${row?.last_name || ''}`.trim();
    recruiterName = full || undefined;
  }

  const workHistory = ((parsed.work_history as Array<Record<string, unknown>> | undefined) || []).map((w) => ({
    company: String(w.company || w.employer || ''),
    title: String(w.title || w.role || w.position || ''),
    duration: String(w.duration || w.duration_years || ''),
  }));
  const projects = ((parsed.projects as Array<Record<string, unknown>> | undefined) || []).map((p) => ({
    name: String(p.name || p.title || ''),
    description: String(p.description || ''),
    technologies: Array.isArray(p.technologies) ? (p.technologies as unknown[]).map(String) : undefined,
  }));

  const result = await generateOutreachEmail({
    candidateName,
    skills: candidate.skills?.length ? candidate.skills : asStringArray(parsed.skills),
    experienceYears: typeof record.total_experience_years === 'number' ? record.total_experience_years : candidate.experience,
    currentTitle: String(record.current_title || ''),
    currentCompany: String(record.current_company || ''),
    projects,
    workHistory,
    summary: String((parsed.summary as string) || candidate.summary || ''),
    targetRole,
    jobDescription,
    companyName,
    recruiterName,
  });

  res.status(200).json({ success: true, data: { to: candidateEmail, subject: result.subject, body: result.body } });
});

export const sendGmailOutreachHandler = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const recruiter = req.recruiter;
  if (!recruiter) {
    throw new AppError('Authentication required', 401, ErrorCodes.VALIDATION_ERROR);
  }
  if (!isGmailConfigured()) {
    throw new AppError('Gmail is not configured on the server.', 503, ErrorCodes.INTERNAL_ERROR);
  }

  const { to, subject, body } = req.body as { to?: string; subject?: string; body?: string };
  if (!to || !isValidEmail(String(to))) {
    throw new AppError('A valid recipient email is required.', 400, ErrorCodes.VALIDATION_ERROR);
  }
  if (!subject?.trim() || !body?.trim()) {
    throw new AppError('Subject and body are required.', 400, ErrorCodes.VALIDATION_ERROR);
  }

  const gmailState = await getRecruiterGmailState(recruiter.id);
  if (!gmailState.connected) {
    res.status(409).json({ success: false, code: 'GMAIL_NOT_CONNECTED', error: 'Gmail is not connected. Please connect Gmail first.' });
    return;
  }
  const refreshToken = await getRecruiterGmailRefreshToken(recruiter.id);
  if (!refreshToken) {
    res.status(409).json({ success: false, code: 'GMAIL_NOT_CONNECTED', error: 'Gmail is not connected. Please connect Gmail first.' });
    return;
  }

  // Verify the candidate exists and the recipient matches the candidate (prevents misdirected sends).
  const { data: candidateRow } = await getSupabaseClient()
    .from('candidates')
    .select('id, email, full_name')
    .eq('id', id)
    .single();
  if (!candidateRow) {
    throw new AppError('Candidate not found', 404, ErrorCodes.NOT_FOUND);
  }

  try {
    const { messageId } = await sendGmailMessage({
      refreshToken,
      to: String(to),
      subject: String(subject),
      textBody: String(body),
    });

    await logEmail(id, 'gmail_outreach', String(subject), String(body));
    logActivity({
      recruiterId: recruiter.id,
      actionType: 'email_sent',
      description: `Gmail outreach sent to ${(candidateRow as { full_name?: string }).full_name || to}`,
      candidateId: id,
    });

    res.status(200).json({ success: true, data: { message: 'Email sent via Gmail', messageId, from: gmailState.email } });
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number }).statusCode || 502;
    const code = (err as { code?: string }).code || 'GMAIL_SEND_FAILED';
    const message = err instanceof Error ? err.message : 'Failed to send via Gmail.';
    res.status(statusCode).json({ success: false, code, error: message });
  }
});