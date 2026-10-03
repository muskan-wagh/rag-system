import crypto from 'crypto';
import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { getSupabaseClient } from '@/services/supabase/client';
import { getAllCandidatesPaginated, logEmail } from '@/services/supabase/database';
import { logActivity } from '@/services/activity';
import { enqueueEmail } from '@/services/queue/emailQueue';
import { broadcast } from '@/services/websocket';
import { logger } from '@/utils/logger';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import {
  validateQuestion,
  validatePublish,
  validateReorder,
  normalizeMcqOptions,
  questionTotals,
  isQuestionType,
} from '@/services/assessments/validation';
import {
  generateInviteToken,
  hashInviteToken,
  encryptInviteToken,
  decryptInviteToken,
  buildAssessmentLink,
  isWindowExpired,
  inviteEmailKey,
} from '@/services/assessments/inviteCrypto';
import {
  buildAssessmentInviteEmail,
  assessmentInviteSubject,
} from '@/services/email/assessmentInvite';

/**
 * Recruiter-side Assessment Builder.
 * Scope: Job -> Hiring Stage -> Assessment -> Questions + Invites.
 * No candidate-side logic. Gmail/Resend infrastructure untouched —
 * invites send through the existing Resend queue/worker only.
 */

// ---------- row types ----------

interface AssessmentRow {
  id: string;
  recruiter_id: string;
  job_id: string | null;
  hiring_stage_id: string | null;
  name: string;
  description: string;
  instructions: string;
  duration_minutes: number;
  passing_score: number;
  skills: string[];
  status: 'draft' | 'published';
  settings: Record<string, unknown>;
  available_from: string | null;
  available_until: string | null;
  created_at: string;
  updated_at: string;
}

interface QuestionRow {
  id: string;
  assessment_id: string;
  type: string;
  position: number;
  title: string;
  prompt: string;
  payload: Record<string, unknown>;
  marks: number;
  skill_tag: string;
  is_required: boolean;
  created_at: string;
}

interface InviteRow {
  id: string;
  assessment_id: string;
  candidate_id: string;
  recruiter_id: string;
  email: string;
  token_hash: string;
  token_encrypted: string | null;
  status: string;
  available_from: string | null;
  available_until: string | null;
  sent_at: string;
  last_sent_at: string;
  send_count: number;
  created_at: string;
}

const DEFAULT_SETTINGS = {
  randomize_questions: false,
  allow_revisit: true,
  auto_submit: true,
};

function toNull(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed ? String(value) : null;
}

function toText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

// ---------- ownership guards (404 for missing OR not-owned: no leakage) ----------

async function requireAssessment(recruiterId: string, assessmentId: string): Promise<AssessmentRow> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('assessments')
    .select('*')
    .eq('id', assessmentId)
    .eq('recruiter_id', recruiterId)
    .maybeSingle();
  if (error) {
    throw new AppError(`Failed to load assessment: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
  if (!data) {
    throw new AppError('Assessment not found', 404, ErrorCodes.NOT_FOUND);
  }
  return data as AssessmentRow;
}

async function requireJob(recruiterId: string, jobId: string): Promise<{ id: string; title: string }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('jobs')
    .select('id, title')
    .eq('id', jobId)
    .eq('recruiter_id', recruiterId)
    .maybeSingle();
  if (error) {
    throw new AppError(`Failed to load job: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
  if (!data) {
    throw new AppError('Job not found', 404, ErrorCodes.NOT_FOUND);
  }
  return data as { id: string; title: string };
}

function requireDraft(assessment: AssessmentRow): void {
  if (assessment.status !== 'draft') {
    throw new AppError(
      'Published assessments are locked. Unpublish to draft before editing.',
      409,
      ErrorCodes.VALIDATION_ERROR,
    );
  }
}

async function getQuestions(assessmentId: string): Promise<QuestionRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('assessment_questions')
    .select('*')
    .eq('assessment_id', assessmentId)
    .order('position', { ascending: true });
  if (error) {
    throw new AppError(`Failed to load questions: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
  return (data || []) as QuestionRow[];
}

/**
 * Reuse the existing Assessment stage for a job, creating it once when absent.
 * UNIQUE(job_id, stage_type) backs this; a 23505 race re-reads the winner.
 */
async function ensureAssessmentStage(recruiterId: string, jobId: string): Promise<string> {
  const supabase = getSupabaseClient();
  const { data: existing, error: readError } = await supabase
    .from('hiring_stages')
    .select('id')
    .eq('job_id', jobId)
    .eq('stage_type', 'Assessment')
    .maybeSingle();
  if (readError) {
    throw new AppError(`Failed to load hiring stage: ${readError.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
  if (existing) return (existing as { id: string }).id;

  const { count } = await supabase
    .from('hiring_stages')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', jobId);

  const { data: created, error: createError } = await supabase
    .from('hiring_stages')
    .insert({
      job_id: jobId,
      recruiter_id: recruiterId,
      stage_type: 'Assessment',
      position: count || 0,
      config: {},
    })
    .select('id')
    .single();

  if (createError) {
    // Lost a creation race (UNIQUE) — the other request's row is canonical.
    if (createError.code === '23505') {
      const { data: winner } = await supabase
        .from('hiring_stages')
        .select('id')
        .eq('job_id', jobId)
        .eq('stage_type', 'Assessment')
        .maybeSingle();
      if (winner) return (winner as { id: string }).id;
    }
    throw new AppError(`Failed to create hiring stage: ${createError.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
  return (created as { id: string }).id;
}

// ---------- jobs (minimal: creation + selection for assessment setup) ----------

export const listJobsHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = req.recruiter?.id as string;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('jobs')
    .select('id, title, description, upload_session_id, created_at')
    .eq('recruiter_id', recruiterId)
    .order('created_at', { ascending: false });
  if (error) {
    throw new AppError(`Failed to list jobs: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
  res.status(200).json({ success: true, data: data || [] });
});

export const createJobHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = req.recruiter?.id as string;
  const { title, description, upload_session_id: uploadSessionId } = req.body as {
    title?: string;
    description?: string;
    upload_session_id?: string;
  };
  const supabase = getSupabaseClient();

  // upload_session_id is an optional legacy bridge — verify ownership when given.
  if (uploadSessionId) {
    const { data: session } = await supabase
      .from('upload_sessions')
      .select('id, recruiter_id')
      .eq('id', uploadSessionId)
      .maybeSingle();
    const row = session as { id: string; recruiter_id: string | null } | null;
    if (!row || (row.recruiter_id && row.recruiter_id !== recruiterId)) {
      throw new AppError('Upload session not found', 404, ErrorCodes.NOT_FOUND);
    }
  }

  const { data, error } = await supabase
    .from('jobs')
    .insert({
      recruiter_id: recruiterId,
      title: String(title).trim(),
      description: toText(description),
      upload_session_id: uploadSessionId || null,
    })
    .select('id, title, description, upload_session_id, created_at')
    .single();
  if (error || !data) {
    throw new AppError(`Failed to create job: ${error?.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
  res.status(201).json({ success: true, data });
});

// ---------- assessments ----------

export const listAssessmentsHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = req.recruiter?.id as string;
  const { jobId, status } = req.query as { jobId?: string; status?: string };
  const supabase = getSupabaseClient();

  let query = supabase
    .from('assessments')
    .select('id, job_id, hiring_stage_id, name, description, duration_minutes, passing_score, skills, status, available_from, available_until, created_at, updated_at')
    .eq('recruiter_id', recruiterId)
    .order('updated_at', { ascending: false });
  if (jobId) query = query.eq('job_id', jobId);
  if (status === 'draft' || status === 'published') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) {
    throw new AppError(`Failed to list assessments: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
  const rows = (data || []) as AssessmentRow[];

  // Totals per assessment in one extra query (small N; avoids N+1).
  const totals = new Map<string, { totalQuestions: number; totalMarks: number }>();
  if (rows.length > 0) {
    const { data: questions } = await supabase
      .from('assessment_questions')
      .select('assessment_id, marks')
      .in('assessment_id', rows.map((r) => r.id));
    const agg = new Map<string, number[]>();
    for (const q of (questions || []) as Array<{ assessment_id: string; marks: number }>) {
      const arr = agg.get(q.assessment_id) || [];
      arr.push(Number(q.marks) || 0);
      agg.set(q.assessment_id, arr);
    }
    for (const r of rows) {
      const marks = agg.get(r.id) || [];
      totals.set(r.id, questionTotals(marks.map((m) => ({ marks: m }))));
    }
  }

  res.status(200).json({
    success: true,
    data: rows.map((r) => ({ ...r, ...(totals.get(r.id) || { totalQuestions: 0, totalMarks: 0 }) })),
  });
});

export const createAssessmentHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = req.recruiter?.id as string;
  const body = req.body as Record<string, unknown>;
  const supabase = getSupabaseClient();

  let jobId: string | null = null;
  let stageId: string | null = null;
  const newJob = body.new_job as { title?: string; description?: string } | undefined;

  if (newJob && typeof newJob.title === 'string' && newJob.title.trim()) {
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        recruiter_id: recruiterId,
        title: newJob.title.trim(),
        description: toText(newJob.description),
      })
      .select('id')
      .single();
    if (jobError || !job) {
      throw new AppError(`Failed to create job: ${jobError?.message}`, 500, ErrorCodes.DATABASE_ERROR);
    }
    jobId = (job as { id: string }).id;
    stageId = await ensureAssessmentStage(recruiterId, jobId);
  } else if (typeof body.job_id === 'string' && body.job_id.trim()) {
    await requireJob(recruiterId, body.job_id.trim());
    jobId = body.job_id.trim();
    stageId = await ensureAssessmentStage(recruiterId, jobId);
  }

  const settings = { ...DEFAULT_SETTINGS, ...((body.settings as Record<string, unknown>) || {}) };

  const { data, error } = await supabase
    .from('assessments')
    .insert({
      recruiter_id: recruiterId,
      job_id: jobId,
      hiring_stage_id: stageId,
      name: toText(body.name),
      description: toText(body.description),
      instructions: toText(body.instructions),
      duration_minutes: typeof body.duration_minutes === 'number' ? body.duration_minutes : 60,
      passing_score: typeof body.passing_score === 'number' ? body.passing_score : 0,
      skills: Array.isArray(body.skills) ? (body.skills as unknown[]).map(String) : [],
      status: 'draft',
      settings,
      available_from: toNull(body.available_from),
      available_until: toNull(body.available_until),
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new AppError(`Failed to create assessment: ${error?.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }

  logActivity({
    recruiterId,
    actionType: 'assessment_created',
    description: `Assessment created: ${(data as AssessmentRow).name || 'Untitled'}`,
    metadata: { assessmentId: (data as AssessmentRow).id },
  }).catch(() => {});

  res.status(201).json({ success: true, data });
});

export const getAssessmentHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = req.recruiter?.id as string;
  const assessmentId = req.params.assessmentId as string;
  const assessment = await requireAssessment(recruiterId, assessmentId);
  const questions = await getQuestions(assessmentId);
  const supabase = getSupabaseClient();

  let job: { id: string; title: string } | null = null;
  if (assessment.job_id) {
    const { data } = await supabase
      .from('jobs')
      .select('id, title')
      .eq('id', assessment.job_id)
      .maybeSingle();
    job = (data as { id: string; title: string } | null) || null;
  }

  const { count: inviteCount } = await supabase
    .from('assessment_invites')
    .select('id', { count: 'exact', head: true })
    .eq('assessment_id', assessmentId);

  res.status(200).json({
    success: true,
    data: {
      ...assessment,
      ...questionTotals(questions),
      questions,
      job,
      inviteCount: inviteCount || 0,
    },
  });
});

/** Explicit Save Draft — no autosave anywhere in this flow (correction #11). */
export const updateAssessmentHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = req.recruiter?.id as string;
  const assessmentId = req.params.assessmentId as string;
  const assessment = await requireAssessment(recruiterId, assessmentId);
  requireDraft(assessment);

  const body = req.body as Record<string, unknown>;
  const supabase = getSupabaseClient();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  for (const key of ['name', 'description', 'instructions'] as const) {
    if (body[key] !== undefined) updates[key] = toText(body[key]);
  }
  if (body.duration_minutes !== undefined) updates.duration_minutes = body.duration_minutes;
  if (body.passing_score !== undefined) updates.passing_score = body.passing_score;
  if (body.skills !== undefined) {
    updates.skills = Array.isArray(body.skills) ? (body.skills as unknown[]).map(String) : [];
  }
  if (body.settings !== undefined) {
    updates.settings = { ...(assessment.settings || DEFAULT_SETTINGS), ...((body.settings as Record<string, unknown>) || {}) };
  }
  if (body.available_from !== undefined) updates.available_from = toNull(body.available_from);
  if (body.available_until !== undefined) updates.available_until = toNull(body.available_until);

  // Draft-only job relink: new minimal job, existing job, or explicit unlink (null).
  if (body.new_job !== undefined && body.new_job !== null) {
    const newJob = body.new_job as { title?: string; description?: string };
    if (!newJob || typeof newJob.title !== 'string' || !newJob.title.trim()) {
      throw new AppError('New job needs a title.', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        recruiter_id: recruiterId,
        title: newJob.title.trim(),
        description: toText(newJob.description),
      })
      .select('id')
      .single();
    if (jobError || !job) {
      throw new AppError(`Failed to create job: ${jobError?.message}`, 500, ErrorCodes.DATABASE_ERROR);
    }
    updates.job_id = (job as { id: string }).id;
    updates.hiring_stage_id = await ensureAssessmentStage(recruiterId, updates.job_id as string);
  } else if (body.job_id !== undefined) {
    if (body.job_id === null) {
      updates.job_id = null;
      updates.hiring_stage_id = null;
    } else if (typeof body.job_id === 'string' && body.job_id.trim()) {
      await requireJob(recruiterId, body.job_id.trim());
      updates.job_id = body.job_id.trim();
      updates.hiring_stage_id = await ensureAssessmentStage(recruiterId, updates.job_id as string);
    }
  }

  // Light window sanity on save; the full gate runs at publish.
  const from = updates.available_from !== undefined ? updates.available_from : assessment.available_from;
  const until = updates.available_until !== undefined ? updates.available_until : assessment.available_until;
  if (from && until && new Date(String(from)).getTime() >= new Date(String(until)).getTime()) {
    throw new AppError('available_from must be earlier than available_until.', 400, ErrorCodes.VALIDATION_ERROR);
  }

  const { data, error } = await supabase
    .from('assessments')
    .update(updates)
    .eq('id', assessmentId)
    .eq('recruiter_id', recruiterId)
    .select('*')
    .single();
  if (error || !data) {
    throw new AppError(`Failed to save draft: ${error?.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
  res.status(200).json({ success: true, data });
});

export const publishAssessmentHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = req.recruiter?.id as string;
  const assessmentId = req.params.assessmentId as string;
  const assessment = await requireAssessment(recruiterId, assessmentId);

  if (assessment.status === 'published') {
    res.status(200).json({ success: true, data: assessment });
    return;
  }

  const questions = await getQuestions(assessmentId);
  const errors = validatePublish({
    name: assessment.name,
    passing_score: assessment.passing_score,
    available_from: assessment.available_from,
    available_until: assessment.available_until,
    questions: questions.map((q) => ({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      payload: q.payload || {},
      marks: Number(q.marks),
    })),
  });
  if (errors.length > 0) {
    res.status(400).json({ success: false, code: ErrorCodes.VALIDATION_ERROR, error: 'Assessment is not ready to publish.', details: errors });
    return;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('assessments')
    .update({ status: 'published', updated_at: new Date().toISOString() })
    .eq('id', assessmentId)
    .eq('recruiter_id', recruiterId)
    .select('*')
    .single();
  if (error || !data) {
    throw new AppError(`Failed to publish: ${error?.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }

  broadcast('assessment:published', { assessmentId });
  logActivity({
    recruiterId,
    actionType: 'assessment_published',
    description: `Assessment published: ${assessment.name}`,
    metadata: { assessmentId },
  }).catch(() => {});

  res.status(200).json({ success: true, data });
});

export const unpublishAssessmentHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = req.recruiter?.id as string;
  const assessmentId = req.params.assessmentId as string;
  const assessment = await requireAssessment(recruiterId, assessmentId);
  if (assessment.status !== 'published') {
    throw new AppError('Only a published assessment can be unpublished.', 400, ErrorCodes.VALIDATION_ERROR);
  }
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('assessments')
    .update({ status: 'draft', updated_at: new Date().toISOString() })
    .eq('id', assessmentId)
    .eq('recruiter_id', recruiterId)
    .select('*')
    .single();
  if (error || !data) {
    throw new AppError(`Failed to unpublish: ${error?.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
  broadcast('assessment:updated', { assessmentId, status: 'draft' });
  res.status(200).json({ success: true, data });
});

export const deleteAssessmentHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = req.recruiter?.id as string;
  const assessmentId = req.params.assessmentId as string;
  await requireAssessment(recruiterId, assessmentId);
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('assessments')
    .delete()
    .eq('id', assessmentId)
    .eq('recruiter_id', recruiterId);
  if (error) {
    throw new AppError(`Failed to delete assessment: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
  res.status(200).json({ success: true, data: { message: 'Assessment deleted' } });
});

// ---------- questions ----------

function buildQuestionPayload(type: string, raw: unknown): Record<string, unknown> {
  const payload = (typeof raw === 'object' && raw !== null && !Array.isArray(raw)
    ? { ...(raw as Record<string, unknown>) }
    : {});
  // Normalize MCQ options so ids are stable for reorder/duplicate/publish checks.
  if (type === 'mcq' && payload.options !== undefined) {
    payload.options = normalizeMcqOptions(payload.options);
  }
  return payload;
}

export const addQuestionHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = req.recruiter?.id as string;
  const assessmentId = req.params.assessmentId as string;
  const assessment = await requireAssessment(recruiterId, assessmentId);
  requireDraft(assessment);

  const body = req.body as Record<string, unknown>;
  const errors = validateQuestion({
    type: body.type,
    title: body.title,
    prompt: body.prompt,
    payload: body.payload,
    marks: body.marks,
    skill_tag: body.skill_tag,
    is_required: body.is_required,
  });
  if (errors.length > 0) {
    res.status(400).json({ success: false, code: ErrorCodes.VALIDATION_ERROR, error: errors.join(' '), details: errors });
    return;
  }

  const supabase = getSupabaseClient();
  const existing = await getQuestions(assessmentId);
  const position = existing.length === 0 ? 0 : Math.max(...existing.map((q) => q.position)) + 1;

  const questionType = String(body.type);
  const { data, error } = await supabase
    .from('assessment_questions')
    .insert({
      assessment_id: assessmentId,
      type: questionType,
      position,
      title: toText(body.title),
      prompt: String(body.prompt || '').trim(),
      payload: buildQuestionPayload(questionType, body.payload),
      marks: Number(body.marks),
      skill_tag: toText(body.skill_tag),
      is_required: body.is_required === undefined ? true : Boolean(body.is_required),
    })
    .select('*')
    .single();
  if (error || !data) {
    throw new AppError(`Failed to add question: ${error?.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
  broadcast('assessment:updated', { assessmentId });
  res.status(201).json({ success: true, data });
});

export const updateQuestionHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = req.recruiter?.id as string;
  const assessmentId = req.params.assessmentId as string;
  const questionId = req.params.questionId as string;
  const assessment = await requireAssessment(recruiterId, assessmentId);
  requireDraft(assessment);

  const supabase = getSupabaseClient();
  const { data: current, error: loadError } = await supabase
    .from('assessment_questions')
    .select('*')
    .eq('id', questionId)
    .eq('assessment_id', assessmentId)
    .maybeSingle();
  if (loadError) {
    throw new AppError(`Failed to load question: ${loadError.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
  if (!current) {
    throw new AppError('Question not found', 404, ErrorCodes.NOT_FOUND);
  }
  const row = current as QuestionRow;
  const body = req.body as Record<string, unknown>;

  const merged = {
    type: body.type !== undefined ? body.type : row.type,
    title: body.title !== undefined ? body.title : row.title,
    prompt: body.prompt !== undefined ? body.prompt : row.prompt,
    payload: body.payload !== undefined ? body.payload : row.payload,
    marks: body.marks !== undefined ? body.marks : row.marks,
    skill_tag: body.skill_tag !== undefined ? body.skill_tag : row.skill_tag,
    is_required: body.is_required !== undefined ? body.is_required : row.is_required,
  };

  const errors = validateQuestion({
    type: merged.type,
    title: merged.title,
    prompt: merged.prompt,
    payload: merged.payload,
    marks: merged.marks,
    skill_tag: merged.skill_tag,
    is_required: merged.is_required,
  });
  if (errors.length > 0) {
    res.status(400).json({ success: false, code: ErrorCodes.VALIDATION_ERROR, error: errors.join(' '), details: errors });
    return;
  }

  const mergedType = String(merged.type);
  const { data, error } = await supabase
    .from('assessment_questions')
    .update({
      type: mergedType,
      title: toText(merged.title),
      prompt: String(merged.prompt || '').trim(),
      payload: buildQuestionPayload(mergedType, merged.payload),
      marks: Number(merged.marks),
      skill_tag: toText(merged.skill_tag),
      is_required: Boolean(merged.is_required),
    })
    .eq('id', questionId)
    .eq('assessment_id', assessmentId)
    .select('*')
    .single();
  if (error || !data) {
    throw new AppError(`Failed to update question: ${error?.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
  broadcast('assessment:updated', { assessmentId });
  res.status(200).json({ success: true, data });
});

export const deleteQuestionHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = req.recruiter?.id as string;
  const assessmentId = req.params.assessmentId as string;
  const questionId = req.params.questionId as string;
  const assessment = await requireAssessment(recruiterId, assessmentId);
  requireDraft(assessment);

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('assessment_questions')
    .delete()
    .eq('id', questionId)
    .eq('assessment_id', assessmentId);
  if (error) {
    throw new AppError(`Failed to delete question: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }

  // Compact positions so ordering stays dense.
  const remaining = (await getQuestions(assessmentId)).sort((a, b) => a.position - b.position);
  for (let index = 0; index < remaining.length; index += 1) {
    if (remaining[index].position !== index) {
      await supabase.from('assessment_questions').update({ position: index }).eq('id', remaining[index].id);
    }
  }

  broadcast('assessment:updated', { assessmentId });
  res.status(200).json({ success: true, data: { message: 'Question deleted' } });
});

export const duplicateQuestionHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = req.recruiter?.id as string;
  const assessmentId = req.params.assessmentId as string;
  const questionId = req.params.questionId as string;
  const assessment = await requireAssessment(recruiterId, assessmentId);
  requireDraft(assessment);

  const supabase = getSupabaseClient();
  const { data: current, error: loadError } = await supabase
    .from('assessment_questions')
    .select('*')
    .eq('id', questionId)
    .eq('assessment_id', assessmentId)
    .maybeSingle();
  if (loadError) {
    throw new AppError(`Failed to load question: ${loadError.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
  if (!current) {
    throw new AppError('Question not found', 404, ErrorCodes.NOT_FOUND);
  }
  const row = current as QuestionRow;
  const existing = await getQuestions(assessmentId);
  const position = existing.length === 0 ? 0 : Math.max(...existing.map((q) => q.position)) + 1;

  const { data, error } = await supabase
    .from('assessment_questions')
    .insert({
      assessment_id: assessmentId,
      type: row.type,
      position,
      title: row.title ? `${row.title} (copy)` : '',
      prompt: row.prompt,
      payload: row.payload || {},
      marks: row.marks,
      skill_tag: row.skill_tag,
      is_required: row.is_required,
    })
    .select('*')
    .single();
  if (error || !data) {
    throw new AppError(`Failed to duplicate question: ${error?.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
  broadcast('assessment:updated', { assessmentId });
  res.status(201).json({ success: true, data });
});

export const reorderQuestionsHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = req.recruiter?.id as string;
  const assessmentId = req.params.assessmentId as string;
  const assessment = await requireAssessment(recruiterId, assessmentId);
  requireDraft(assessment);

  const questions = await getQuestions(assessmentId);
  const { orderedIds } = req.body as { orderedIds?: unknown };
  const errors = validateReorder(questions.map((q) => q.id), orderedIds);
  if (errors.length > 0) {
    res.status(400).json({ success: false, code: ErrorCodes.VALIDATION_ERROR, error: errors.join(' '), details: errors });
    return;
  }

  const supabase = getSupabaseClient();
  const ids = orderedIds as string[];
  for (let index = 0; index < ids.length; index += 1) {
    const { error } = await supabase
      .from('assessment_questions')
      .update({ position: index })
      .eq('id', ids[index])
      .eq('assessment_id', assessmentId);
    if (error) {
      throw new AppError(`Failed to reorder questions: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);
    }
  }

  broadcast('assessment:updated', { assessmentId });
  const updated = await getQuestions(assessmentId);
  res.status(200).json({ success: true, data: updated });
});

// ---------- eligible candidates + invites ----------

export const eligibleCandidatesHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = req.recruiter?.id as string;
  const assessmentId = req.params.assessmentId as string;
  await requireAssessment(recruiterId, assessmentId);

  const filter = req.query.filter === 'all' ? 'all' : 'eligible';
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
  const search = typeof req.query.search === 'string' && req.query.search.trim()
    ? req.query.search.trim()
    : undefined;

  // Default scope: Shortlisted + Screening (comma syntax is supported by the
  // shared status filter). `all` lifts the gate — the recruiter picks manually.
  const result = await getAllCandidatesPaginated({
    page,
    limit,
    search,
    sortBy: 'created_at',
    sortOrder: 'desc',
    status: filter === 'eligible' ? 'shortlisted,screening' : undefined,
    recruiterId,
  });

  const supabase = getSupabaseClient();
  const { data: invites } = await supabase
    .from('assessment_invites')
    .select('candidate_id, status, sent_at, last_sent_at, send_count')
    .eq('assessment_id', assessmentId);
  const inviteMap = new Map(
    ((invites || []) as Array<{ candidate_id: string; status: string; sent_at: string; last_sent_at: string; send_count: number }>)
      .map((i) => [i.candidate_id, {
        status: i.status,
        sent_at: i.sent_at,
        last_sent_at: i.last_sent_at,
        send_count: i.send_count,
      }]),
  );

  res.status(200).json({
    success: true,
    data: {
      candidates: result.candidates.map((c) => ({ ...c, invite: inviteMap.get(c.id) || null })),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      filter,
    },
  });
});

export const listInvitesHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = req.recruiter?.id as string;
  const assessmentId = req.params.assessmentId as string;
  await requireAssessment(recruiterId, assessmentId);

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('assessment_invites')
    .select('id, candidate_id, email, status, available_from, available_until, sent_at, last_sent_at, send_count, created_at, candidates(full_name, email)')
    .eq('assessment_id', assessmentId)
    .order('sent_at', { ascending: false });
  if (error) {
    throw new AppError(`Failed to list invites: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
  res.status(200).json({ success: true, data: data || [] });
});

export const createInvitesHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = req.recruiter?.id as string;
  const assessmentId = req.params.assessmentId as string;
  const assessment = await requireAssessment(recruiterId, assessmentId);

  if (assessment.status !== 'published') {
    throw new AppError('Only a published assessment can be sent to candidates.', 409, ErrorCodes.VALIDATION_ERROR);
  }
  if (isWindowExpired(assessment.available_until)) {
    throw new AppError('The assessment availability window has already closed.', 409, ErrorCodes.VALIDATION_ERROR);
  }

  const rawIds = (req.body as { candidateIds?: unknown }).candidateIds;
  const candidateIds = [...new Set((Array.isArray(rawIds) ? rawIds : []).map(String))];
  if (candidateIds.length === 0) {
    throw new AppError('Select at least one candidate.', 400, ErrorCodes.VALIDATION_ERROR);
  }

  const supabase = getSupabaseClient();

  // Recruiter-ownership check: every candidate must belong to req.recruiter.id.
  const { data: candidates, error: candError } = await supabase
    .from('candidates')
    .select('id, email, full_name')
    .in('id', candidateIds)
    .eq('recruiter_id', recruiterId);
  if (candError) {
    throw new AppError(`Failed to verify candidates: ${candError.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
  const owned = new Map(
    ((candidates || []) as Array<{ id: string; email: string; full_name: string }>).map((c) => [c.id, c]),
  );
  const notOwned = candidateIds.filter((id) => !owned.has(id));
  if (notOwned.length > 0) {
    res.status(400).json({
      success: false,
      code: ErrorCodes.VALIDATION_ERROR,
      error: `${notOwned.length} candidate(s) were not found or do not belong to you.`,
      details: { invalidCandidateIds: notOwned },
    });
    return;
  }

  const { data: existingInvites } = await supabase
    .from('assessment_invites')
    .select('candidate_id, status')
    .eq('assessment_id', assessmentId)
    .in('candidate_id', candidateIds);
  const existingByCandidate = new Map(
    ((existingInvites || []) as Array<{ candidate_id: string; status: string }>).map((i) => [i.candidate_id, i.status]),
  );

  // A revoked invite is dead by recruiter action — re-inviting replaces it
  // with a fresh token instead of resurrecting the old link.
  const revokedIds = candidateIds.filter((id) => existingByCandidate.get(id) === 'revoked');
  if (revokedIds.length > 0) {
    await supabase
      .from('assessment_invites')
      .delete()
      .eq('assessment_id', assessmentId)
      .in('candidate_id', revokedIds);
    for (const id of revokedIds) existingByCandidate.delete(id);
  }

  const skippedAlreadyInvited = candidateIds.filter((id) => existingByCandidate.has(id));
  const freshIds = candidateIds.filter((id) => !existingByCandidate.has(id));

  const skippedMissingEmail = freshIds.filter((id) => !(owned.get(id)?.email || '').trim());
  const sendableIds = freshIds.filter((id) => (owned.get(id)?.email || '').trim());

  const invited: Array<{ candidateId: string; email: string; link: string; sentAt: string }> = [];

  for (const candidateId of sendableIds) {
    const candidate = owned.get(candidateId) as { id: string; email: string; full_name: string };
    const token = generateInviteToken();
    const now = new Date().toISOString();
    const { data: row, error: insertError } = await supabase
      .from('assessment_invites')
      .insert({
        assessment_id: assessmentId,
        candidate_id: candidateId,
        recruiter_id: recruiterId,
        email: candidate.email,
        token_hash: hashInviteToken(token),
        token_encrypted: encryptInviteToken(token),
        status: 'sent',
        // Window copied from the assessment at invite time (correction #3).
        available_from: assessment.available_from,
        available_until: assessment.available_until,
        sent_at: now,
        last_sent_at: now,
        send_count: 1,
      })
      .select('sent_at')
      .single();

    if (insertError || !row) {
      // Lost an insert race (UNIQUE) — treat as already invited, never double-send.
      if (insertError?.code === '23505') {
        skippedAlreadyInvited.push(candidateId);
        continue;
      }
      logger.error('Failed to create assessment invite', { error: insertError?.message, assessmentId, candidateId });
      continue;
    }

    const link = buildAssessmentLink(token);
    const subject = assessmentInviteSubject(assessment.name);
    const html = buildAssessmentInviteEmail({
      candidateName: candidate.full_name || 'Candidate',
      assessmentName: assessment.name,
      durationMinutes: assessment.duration_minutes,
      availableFrom: assessment.available_from,
      availableUntil: assessment.available_until,
      instructions: assessment.instructions,
      assessmentLink: link,
    });

    // Existing Resend queue/worker path (fire-and-forget, unchanged infra).
    // Logged as `queued` — NOT `sent`: the worker has no delivery callback,
    // so `sent` would overclaim. See report: remaining gap.
    enqueueEmail({ to: candidate.email, subject, html }).catch(() => {});
    await logEmail(
      candidateId,
      'assessment_invitation',
      subject,
      [
        `Assessment: ${assessment.name}`,
        `Duration: ${assessment.duration_minutes} minutes`,
        `Available from: ${assessment.available_from || '—'}`,
        `Available until: ${assessment.available_until || '—'}`,
        `Instructions: ${(assessment.instructions || '').slice(0, 500)}`,
      ].join('\n'),
      {
        recruiterId,
        provider: 'resend',
        status: 'queued',
        idempotencyKey: inviteEmailKey(assessmentId, candidateId, 1),
      },
    );

    invited.push({
      candidateId,
      email: candidate.email,
      link,
      sentAt: (row as { sent_at: string }).sent_at,
    });
  }

  if (invited.length > 0) {
    logActivity({
      recruiterId,
      actionType: 'assessment_invite_sent',
      description: `Assessment invitations sent for "${assessment.name}" (${invited.length})`,
      metadata: { assessmentId, candidateIds: invited.map((i) => i.candidateId) },
    }).catch(() => {});
    broadcast('assessment:invite_sent', { assessmentId, count: invited.length });
  }

  res.status(200).json({
    success: true,
    data: { invited, skippedAlreadyInvited, skippedMissingEmail },
  });
});

export const resendInviteHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = req.recruiter?.id as string;
  const assessmentId = req.params.assessmentId as string;
  const candidateId = req.params.candidateId as string;
  const assessment = await requireAssessment(recruiterId, assessmentId);

  if (assessment.status !== 'published') {
    throw new AppError('Resend is only available while the assessment is published.', 409, ErrorCodes.VALIDATION_ERROR);
  }

  const supabase = getSupabaseClient();
  const { data: invite, error } = await supabase
    .from('assessment_invites')
    .select('*')
    .eq('assessment_id', assessmentId)
    .eq('candidate_id', candidateId)
    .maybeSingle();
  if (error) {
    throw new AppError(`Failed to load invite: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
  if (!invite) {
    throw new AppError('No invitation found for this candidate.', 404, ErrorCodes.NOT_FOUND);
  }
  const row = invite as InviteRow;

  if (row.status === 'revoked') {
    throw new AppError('This invitation was revoked. Re-invite the candidate to issue a fresh link.', 409, ErrorCodes.VALIDATION_ERROR);
  }
  // Resend is blocked once the invite window has closed (correction #5).
  if (isWindowExpired(row.available_until)) {
    throw new AppError('The invitation window has already closed — resend is blocked.', 409, ErrorCodes.VALIDATION_ERROR);
  }
  if (!row.token_encrypted) {
    throw new AppError('Stored link cannot be recovered. Revoke and re-invite the candidate.', 500, ErrorCodes.DATABASE_ERROR);
  }

  let token: string;
  try {
    token = decryptInviteToken(row.token_encrypted);
  } catch {
    throw new AppError('Stored link cannot be recovered. Revoke and re-invite the candidate.', 500, ErrorCodes.DATABASE_ERROR);
  }

  // Verify the candidate is still owned by this recruiter before emailing.
  const { data: candidate } = await supabase
    .from('candidates')
    .select('id, email, full_name')
    .eq('id', candidateId)
    .eq('recruiter_id', recruiterId)
    .maybeSingle();
  const candidateRow = candidate as { id: string; email: string; full_name: string } | null;
  if (!candidateRow || !(candidateRow.email || '').trim()) {
    throw new AppError('Candidate not found or has no email address.', 404, ErrorCodes.NOT_FOUND);
  }

  // Same token, same row: only counters move (correction #5).
  const sendCount = row.send_count + 1;
  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('assessment_invites')
    .update({ send_count: sendCount, last_sent_at: now })
    .eq('id', row.id);
  if (updateError) {
    throw new AppError(`Failed to update invite: ${updateError.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }

  const link = buildAssessmentLink(token);
  const subject = assessmentInviteSubject(assessment.name);
  const html = buildAssessmentInviteEmail({
    candidateName: candidateRow.full_name || 'Candidate',
    assessmentName: assessment.name,
    durationMinutes: assessment.duration_minutes,
    availableFrom: row.available_from,
    availableUntil: row.available_until,
    instructions: assessment.instructions,
    assessmentLink: link,
  });

  enqueueEmail({ to: candidateRow.email, subject, html }).catch(() => {});
  await logEmail(
    candidateId,
    'assessment_invitation',
    subject,
    `Assessment: ${assessment.name}\nResend #${sendCount}\nDuration: ${assessment.duration_minutes} minutes`,
    {
      recruiterId,
      provider: 'resend',
      status: 'queued',
      idempotencyKey: inviteEmailKey(assessmentId, candidateId, sendCount),
    },
  );
  logActivity({
    recruiterId,
    actionType: 'assessment_invite_sent',
    description: `Assessment invitation resent for "${assessment.name}" (#${sendCount})`,
    candidateId,
    metadata: { assessmentId },
  }).catch(() => {});

  res.status(200).json({ success: true, data: { message: 'Invitation resent', sendCount, lastSentAt: now } });
});

export const revokeInviteHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = req.recruiter?.id as string;
  const assessmentId = req.params.assessmentId as string;
  const candidateId = req.params.candidateId as string;
  await requireAssessment(recruiterId, assessmentId);

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('assessment_invites')
    .update({ status: 'revoked' })
    .eq('assessment_id', assessmentId)
    .eq('candidate_id', candidateId)
    .select('id')
    .maybeSingle();
  if (error) {
    throw new AppError(`Failed to revoke invite: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
  if (!data) {
    throw new AppError('No invitation found for this candidate.', 404, ErrorCodes.NOT_FOUND);
  }
  res.status(200).json({ success: true, data: { message: 'Invitation revoked' } });
});

// Re-exported for tests (pure helpers stay importable without Express).
export const __testables = {
  isQuestionType,
  fingerprint: (value: string) => crypto.createHash('sha256').update(value).digest('hex').slice(0, 8),
};
