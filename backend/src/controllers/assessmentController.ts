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
  generateAssessmentQuestions,
  totalRequestedCount,
  type GenerationRequest,
  type GenerationQuestionType,
  type NormalizedGeneratedQuestion,
} from '@/services/assessments/generationService';
import {
  buildAssessmentInviteEmail,
  assessmentInviteSubject,
} from '@/services/email/assessmentInvite';
import {
  buildSnapshot,
  persistSnapshot,
  resolveQuestionsForAttempt,
  type SnapshotCapableAssessment,
} from '@/services/assessments/snapshot';
import { assertJobAccepts } from '@/services/hiring/jobLifecycleService';
import { getApplicationRecord, setApplicationStage } from '@/services/hiring/applicationService';
import { canSendAssessmentTo } from '@/services/hiring/decisionService';
import { mergeProgressionConfig } from '@/controllers/jobWorkflowController';

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
  /** Published question version this link is pinned to (20261010). */
  snapshot_version?: number | null;
  /** Real email outcome: pending | sent | failed (20261010). */
  delivery_status?: string | null;
  job_application_id?: string | null;
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
    // `status` is new in 20261008. Selecting a column that does not exist yet
    // makes PostgREST return an error for the whole query, so the workspace job
    // switcher falls back to a defaulted list rather than failing outright.
    .select('id, title, description, upload_session_id, created_at, status, closed_at, progression_config')
    .eq('recruiter_id', recruiterId)
    .order('created_at', { ascending: false });
  if (error) {
    throw new AppError(`Failed to list jobs: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
  res.status(200).json({
    success: true,
    data: (data || []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        ...r,
        status: r.status === 'closed' ? 'closed' : 'open',
        progression_config: mergeProgressionConfig(r.progression_config),
      };
    }),
  });
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
  const assessment = (await requireAssessment(recruiterId, assessmentId)) as AssessmentRow & {
    snapshot_version?: number;
    published_snapshot?: unknown;
  };

  // Republishing an already-published assessment is not a no-op: the recruiter
  // may have edited the draft questions and wants a NEW version. Each publish
  // therefore bumps the version and re-snapshots, which is exactly what makes
  // the version meaningful. Returns the current state when nothing changed.
  const previousVersion = Number(assessment.snapshot_version ?? 0);

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

  // Freeze the question set BEFORE flipping status to published, in one
  // conditional write. If the version changed under us (a concurrent publish),
  // persistSnapshot throws a 409 rather than silently overwriting and leaving
  // two different question sets claiming the same version.
  const snapshot = buildSnapshot({
    assessment: assessment as unknown as SnapshotCapableAssessment,
    questions,
    nextVersion: previousVersion + 1,
  });

  const { version } = await persistSnapshot({
    assessmentId,
    recruiterId,
    previousVersion,
    snapshot,
  });

  broadcast('assessment:published', { assessmentId, snapshotVersion: version });
  logActivity({
    recruiterId,
    actionType: 'assessment_published',
    description: `Assessment published: ${assessment.name} (v${version})`,
    metadata: { assessmentId, snapshotVersion: version, totalMarks: snapshot.total_marks },
  }).catch(() => {});

  res.status(200).json({
    success: true,
    data: {
      ...assessment,
      status: 'published',
      snapshot_version: version,
      totalQuestions: snapshot.questions.length,
      totalMarks: snapshot.total_marks,
    },
  });
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
  const assessment = await requireAssessment(recruiterId, assessmentId);
  const supabase = getSupabaseClient();

  // `assessment_attempts.candidate_id -> assessment_id` is ON DELETE CASCADE, so
  // deleting a published assessment used to destroy live candidate attempts,
  // their saved answers, and their scores. Never delete something a candidate is
  // currently sitting in; unpublish instead.
  if ((assessment as { status?: string }).status === 'published') {
    throw new AppError(
      'Unpublish this assessment before deleting it — candidates may be mid-attempt.',
      409,
      ErrorCodes.VALIDATION_ERROR,
    );
  }
  const { count } = await supabase
    .from('assessment_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('assessment_id', assessmentId);
  if ((count || 0) > 0) {
    throw new AppError(
      `This assessment has ${count} candidate attempt(s) and cannot be deleted. Unpublish it instead.`,
      409,
      ErrorCodes.VALIDATION_ERROR,
    );
  }

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
  const assessment = await requireAssessment(recruiterId, assessmentId);

  const filter = req.query.filter === 'all' ? 'all' : 'eligible';
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
  const search = typeof req.query.search === 'string' && req.query.search.trim()
    ? req.query.search.trim()
    : undefined;

  const supabase = getSupabaseClient();

  // ── Eligibility = SHORTLISTED on this job's application ─────────────────────
  //
  // This used to be derived from `screening_results.status IN ('passed',
  // 'overridden')`, which made an AI score an implicit recruiter decision: a
  // candidate the model happened to pass landed in the invitation queue whether
  // or not a human had ever looked at them. Worse, it filtered on
  // `candidates.current_status` — a GLOBAL column — to exclude rejections, so
  // being rejected for Job B could remove someone from Job A's queue.
  //
  // It is now a query on `job_applications` for THIS job, which cannot leak
  // across jobs. `all` still lifts the gate so a recruiter can pick manually.
  let eligibleIds: string[] | undefined;
  const screeningByCandidate = new Map<string, { status: string; overall: number }>();
  let shortlistNoteByCandidate = new Map<string, string | null>();

  if (filter === 'eligible' && assessment.job_id) {
    const { data: rows } = await supabase
      .from('job_applications')
      .select('candidate_id, shortlisted_at, shortlist_note')
      .eq('job_id', assessment.job_id)
      .eq('current_stage', 'Shortlisted');

    const shortlisted = (rows || []) as Array<{
      candidate_id: string;
      shortlisted_at: string | null;
      shortlist_note: string | null;
    }>;
    eligibleIds = shortlisted.map((r) => r.candidate_id);
    shortlistNoteByCandidate = new Map(
      shortlisted.map((r) => [r.candidate_id, r.shortlist_note ?? null]),
    );

    // Screening score is CONTEXT, not the gate. A candidate shortlisted without
    // a screening run still shows up, with a null score, so the recruiter sees
    // the truth rather than a fabricated number.
    if (eligibleIds.length > 0) {
      const { data: screeningRows } = await supabase
        .from('screening_results')
        .select('candidate_id, status, overall')
        .eq('job_id', assessment.job_id)
        .in('candidate_id', eligibleIds);
      for (const r of (screeningRows || []) as Array<{ candidate_id: string; status: string; overall: number }>) {
        screeningByCandidate.set(r.candidate_id, {
          status: r.status,
          overall: Number(r.overall) || 0,
        });
      }
    }
  }

  const result = await getAllCandidatesPaginated({
    page,
    limit,
    search,
    sortBy: 'created_at',
    sortOrder: 'desc',
    status: filter === 'eligible' && !assessment.job_id ? 'shortlisted,screening' : undefined,
    interviewCandidateIds: eligibleIds,
    recruiterId,
  });

  const { data: invites } = await supabase
    .from('assessment_invites')
    .select('candidate_id, status, delivery_status, sent_at, last_sent_at, send_count, snapshot_version')
    .eq('assessment_id', assessmentId);
  const inviteMap = new Map(
    ((invites || []) as Array<{
      candidate_id: string;
      status: string;
      delivery_status: string;
      sent_at: string;
      last_sent_at: string;
      send_count: number;
      snapshot_version: number | null;
    }>).map((i) => [
      i.candidate_id,
      {
        status: i.status,
        delivery_status: i.delivery_status,
        sent_at: i.sent_at,
        last_sent_at: i.last_sent_at,
        send_count: i.send_count,
        snapshot_version: i.snapshot_version,
      },
    ]),
  );

  res.status(200).json({
    success: true,
    data: {
      candidates: result.candidates.map((c) => ({
        ...c,
        invite: inviteMap.get(c.id) || null,
        screening: screeningByCandidate.get(c.id) || null,
        shortlistNote: shortlistNoteByCandidate.get(c.id) ?? null,
      })),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      filter,
      jobId: assessment.job_id,
      eligibilityRule:
        filter === 'eligible'
          ? assessment.job_id
            ? 'Shortlisted for this job'
            : 'Legacy: candidate status shortlisted or screening'
          : 'All owned candidates (gate lifted)',
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
    .select(
      'id, candidate_id, email, status, delivery_status, snapshot_version, available_from, available_until, sent_at, last_sent_at, send_count, created_at, candidates(full_name, email)',
    )
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
  const assessment = (await requireAssessment(recruiterId, assessmentId)) as AssessmentRow & {
    snapshot_version?: number;
  };

  if (assessment.status !== 'published') {
    throw new AppError('Only a published assessment can be sent to candidates.', 409, ErrorCodes.VALIDATION_ERROR);
  }
  if (isWindowExpired(assessment.available_until)) {
    throw new AppError('The assessment availability window has already closed.', 409, ErrorCodes.VALIDATION_ERROR);
  }

  // The invite is pinned to the published version. Grading will read the
  // snapshot, so a later republish cannot retroactively change what this link
  // means for the candidate who received it today.
  const snapshotVersion = Number(assessment.snapshot_version ?? 0);
  if (snapshotVersion < 1) {
    throw new AppError(
      'This assessment has no published snapshot, so its questions cannot be pinned. Republish it, then send invitations.',
      409,
      ErrorCodes.CONFLICT,
    );
  }

  // A closed job refuses new invitations unless the recruiter has explicitly
  // enabled the override for this job. Fail-closed.
  if (assessment.job_id) {
    await assertJobAccepts(recruiterId, assessment.job_id, 'invite', { respectInviteOverride: true });
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

  // ── Eligibility is a SHORTLIST on this job's application ────────────────────
  // Previously this handler only checked ownership, so anyone the recruiter
  // happened to have in their candidate pool could be invited. Eligibility is
  // now exactly "a recruiter put this person at Shortlisted on this job".
  if (assessment.job_id) {
    const ineligible: Array<{ candidateId: string; reason: string }> = [];
    for (const candidateId of candidateIds) {
      const permission = await canSendAssessmentTo(recruiterId, assessment.job_id, candidateId);
      const application = await getApplicationRecord(assessment.job_id, candidateId);
      if (!permission.allowed) {
        ineligible.push({
          candidateId,
          reason: permission.reason ?? 'Not eligible for an assessment in this job.',
        });
        continue;
      }
      // Shortlist is the gate, not merely "still in the pipeline".
      if (application?.current_stage !== 'Shortlisted') {
        ineligible.push({
          candidateId,
          reason: `Candidate is at ${application?.current_stage ?? 'no stage'}. Shortlist them first.`,
        });
      }
    }
    if (ineligible.length > 0) {
      res.status(409).json({
        success: false,
        code: ErrorCodes.CONFLICT,
        error: `${ineligible.length} candidate(s) are not eligible for this assessment.`,
        details: { ineligible },
      });
      return;
    }
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

  const { data: jobRow } = assessment.job_id
    ? await supabase
        .from('jobs')
        .select('title, organization_name')
        .eq('id', assessment.job_id)
        .maybeSingle()
    : { data: null };
  const jobTitle = String((jobRow as { title?: string } | null)?.title ?? '');
  const companyName =
    String((jobRow as { organization_name?: string } | null)?.organization_name ?? '') || 'HireStack';

  const invited: Array<{ candidateId: string; email: string; link: string; sentAt: string }> = [];
  const failed: Array<{ candidateId: string; reason: string }> = [];

  for (const candidateId of sendableIds) {
    const candidate = owned.get(candidateId) as { id: string; email: string; full_name: string };
    const token = generateInviteToken();
    const now = new Date().toISOString();
    const application = assessment.job_id
      ? await getApplicationRecord(assessment.job_id, candidateId)
      : null;

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
        // Pinned to the job application and the published question version.
        snapshot_version: snapshotVersion,
        job_application_id: application?.id ?? null,
        // Honest starting state: the email has not left the queue yet.
        delivery_status: 'pending',
      })
      .select('id, sent_at')
      .single();

    if (insertError || !row) {
      // Lost an insert race (UNIQUE) — treat as already invited, never double-send.
      if (insertError?.code === '23505') {
        skippedAlreadyInvited.push(candidateId);
        continue;
      }
      // Previously this candidate was silently dropped: not in `invited`, not in
      // any skip list, and the response still said success. Surface it.
      logger.error('Failed to create assessment invite', { error: insertError?.message, assessmentId, candidateId });
      failed.push({
        candidateId,
        reason: insertError?.message ?? 'Could not create the invitation record.',
      });
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
      jobTitle,
      companyName,
    });

    // The idempotency key MUST reach the queue: the worker needs it to find
    // this row and write the REAL delivery outcome into both `email_logs` and
    // `assessment_invites.delivery_status`. Without it the invite sat at
    // 'queued' forever and the UI could not tell sent from failed.
    const idempotencyKey = inviteEmailKey(assessmentId, candidateId, 1);
    const enqueued = await enqueueEmail({
      to: candidate.email,
      subject,
      html,
      idempotencyKey,
      inviteId: ((row as { id?: string }).id || undefined),
      inviteCandidateId: candidateId,
    });
    const deliveryStatus = enqueued.queued ? 'pending' : 'failed';

    if (!enqueued.queued) {
      await supabase
        .from('assessment_invites')
        .update({ delivery_status: 'failed' })
        .eq('assessment_id', assessmentId)
        .eq('candidate_id', candidateId)
        .neq('status', 'revoked');
      logger.error('Assessment invite could not be queued', {
        assessmentId,
        candidateId,
        error: enqueued.error,
      });
    }

    await logEmail(
      candidateId,
      'assessment_invitation',
      subject,
      [
        `Assessment: ${assessment.name} (v${snapshotVersion})`,
        `Job: ${jobTitle || '—'}`,
        `Duration: ${assessment.duration_minutes} minutes`,
        `Available from: ${assessment.available_from || '—'}`,
        `Available until: ${assessment.available_until || '—'}`,
        `Instructions: ${(assessment.instructions || '').slice(0, 500)}`,
      ].join('\n'),
      {
        recruiterId,
        provider: 'resend',
        status: deliveryStatus === 'failed' ? 'failed' : 'queued',
        error: enqueued.queued ? undefined : enqueued.error,
        idempotencyKey,
      },
    );

    // ── Issuing the invitation IS the move into the Assessment stage ───────────
    // Leaving the application at `Shortlisted` while an assessment is outstanding
    // made the pipeline lie. Two concrete failures resulted:
    //   1. On submit, progression is enqueued with `fromStage: 'Assessment'` from
    //      the job payload. The central write path correctly re-reads the REAL
    //      stage — `Shortlisted` — and rejects `Shortlisted → Technical Round` as
    //      a skipped stage, so every auto-advance failed with a 409.
    //   2. The workspace showed a candidate who had finished the assessment still
    //      sitting in the shortlist stage.
    // Sending an invitation is an explicit, recruiter-driven action, which is
    // exactly the semantics `Shortlisted → Assessment` describes. The trigger id
    // is keyed on the invite row, so a retry or a second click is a no-op.
    if (assessment.job_id) {
      try {
        await setApplicationStage({
          jobId: assessment.job_id,
          candidateId,
          recruiterId,
          toStage: 'Assessment',
          triggerType: 'manual',
          triggerId: `assessment-invited:${(row as { id?: string }).id ?? `${assessmentId}:${candidateId}`}`,
          metadata: {
            action: 'assessment_invited',
            assessment_id: assessmentId,
            snapshot_version: snapshotVersion,
          },
        });
      } catch (err) {
        // The invitation is already persisted and the email is already queued.
        // A stage-transition failure here must not lose the invitation, but it
        // must be visible rather than silently leaving the pipeline wrong.
        logger.error('[invites] could not move the application into Assessment', {
          assessmentId,
          candidateId,
          error: err instanceof Error ? err.message : String(err),
        });
        failed.push({
          candidateId,
          reason: 'Invitation sent, but the candidate could not be moved to the Assessment stage. Open their application and retry.',
        });
      }
    }

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
      metadata: {
        assessmentId,
        snapshotVersion,
        candidateIds: invited.map((i) => i.candidateId),
      },
    }).catch(() => {});
    broadcast('assessment:invite_sent', { assessmentId, count: invited.length, snapshotVersion });
  }

  res.status(200).json({
    success: true,
    data: {
      invited,
      skippedAlreadyInvited,
      skippedMissingEmail,
      failed,
      snapshotVersion,
    },
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

  // Same token, same row, SAME SNAPSHOT VERSION: only counters move
  // (correction #5). An already-issued URL must keep meaning the same
  // assessment, so a republish in between cannot change what this link delivers.
  const sendCount = row.send_count + 1;
  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('assessment_invites')
    .update({ send_count: sendCount, last_sent_at: now, delivery_status: 'pending' })
    .eq('id', row.id);
  if (updateError) {
    throw new AppError(`Failed to update invite: ${updateError.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }

  const link = buildAssessmentLink(token);
  const subject = assessmentInviteSubject(assessment.name);

  const { data: jobRow } = assessment.job_id
    ? await supabase.from('jobs').select('title, organization_name').eq('id', assessment.job_id).maybeSingle()
    : { data: null };

  const html = buildAssessmentInviteEmail({
    candidateName: candidateRow.full_name || 'Candidate',
    assessmentName: assessment.name,
    durationMinutes: assessment.duration_minutes,
    availableFrom: row.available_from,
    availableUntil: row.available_until,
    instructions: assessment.instructions,
    assessmentLink: link,
    jobTitle: String((jobRow as { title?: string } | null)?.title ?? ''),
    companyName: String((jobRow as { organization_name?: string } | null)?.organization_name ?? '') || 'HireStack',
    version: row.snapshot_version ?? null,
  });

  const idempotencyKey = inviteEmailKey(assessmentId, candidateId, sendCount);
  const enqueued = await enqueueEmail({
    to: candidateRow.email,
    subject,
    html,
    idempotencyKey,
    inviteId: row.id,
    inviteCandidateId: candidateId,
  });

  if (!enqueued.queued) {
    await supabase.from('assessment_invites').update({ delivery_status: 'failed' }).eq('id', row.id);
  }

  await logEmail(
    candidateId,
    'assessment_invitation',
    subject,
    `Assessment: ${assessment.name}\nResend #${sendCount}\nDuration: ${assessment.duration_minutes} minutes`,
    {
      recruiterId,
      provider: 'resend',
      status: enqueued.queued ? 'queued' : 'failed',
      error: enqueued.queued ? undefined : enqueued.error,
      idempotencyKey,
    },
  );
  logActivity({
    recruiterId,
    actionType: 'assessment_invite_sent',
    description: `Assessment invitation resent for "${assessment.name}" (#${sendCount})`,
    candidateId,
    metadata: { assessmentId, sendCount },
  }).catch(() => {});

  res.status(200).json({
    success: true,
    data: {
      message: 'Invitation resent',
      sendCount,
      lastSentAt: now,
      deliveryStatus: enqueued.queued ? 'pending' : 'failed',
      ...(enqueued.queued ? {} : { error: enqueued.error }),
    },
  });
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

// ---------- AI assessment generation (job-specific, draft-only) ----------

const GENERATION_TYPES = ['mcq', 'coding', 'sql', 'subjective'] as const;

function parseTypeCounts(raw: unknown): Partial<Record<GenerationQuestionType, number>> {
  const rec =
    typeof raw === 'object' && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const out: Partial<Record<GenerationQuestionType, number>> = {};
  for (const t of GENERATION_TYPES) {
    const n = Number(rec[t]);
    if (Number.isFinite(n) && n > 0) out[t] = Math.min(30, Math.floor(n));
  }
  return out;
}

/**
 * Build the generation context server-side from the Job + real
 * screening/RAG insights (frequent matched skills = required,
 * frequent missing skills = preferred focus). Recruiter-supplied
 * skill lists are treated as hints only.
 */
async function buildGenerationContext(
  recruiterId: string,
  jobId: string,
  body: Record<string, unknown>,
): Promise<{ request: GenerationRequest; title: string; description: string }> {
  const supabase = getSupabaseClient();
  const { data: job } = await supabase
    .from('jobs')
    .select('id, title, description')
    .eq('id', jobId)
    .eq('recruiter_id', recruiterId)
    .maybeSingle();
  if (!job) {
    throw new AppError('Job not found', 404, ErrorCodes.NOT_FOUND);
  }
  const jobRow = job as { id: string; title: string; description: string | null };

  const { data: screened } = await supabase
    .from('screening_results')
    .select('matched_skills, missing_skills')
    .eq('job_id', jobId)
    .limit(50);
  const matchedFreq = new Map<string, number>();
  const missingFreq = new Map<string, number>();
  for (const r of (screened || []) as Array<{ matched_skills: string[]; missing_skills: string[] }>) {
    for (const s of r.matched_skills || []) matchedFreq.set(s, (matchedFreq.get(s) || 0) + 1);
    for (const s of r.missing_skills || []) missingFreq.set(s, (missingFreq.get(s) || 0) + 1);
  }
  const top = (m: Map<string, number>, n: number) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([s]) => s);
  const hinted = Array.isArray(body.skills) ? (body.skills as unknown[]).map(String) : [];

  const questionTypes = parseTypeCounts(body.question_types);
  if (totalRequestedCount({ questionTypes } as GenerationRequest) === 0) {
    throw new AppError(
      'question_types must request at least 1 question across mcq/coding/sql/subjective.',
      400,
      ErrorCodes.VALIDATION_ERROR,
    );
  }
  const difficultyRaw = String(body.difficulty || 'mixed');
  const difficulty = (['easy', 'medium', 'hard', 'mixed'] as const).includes(difficultyRaw as 'mixed')
    ? (difficultyRaw as GenerationRequest['difficulty'])
    : 'mixed';

  return {
    request: {
      jobTitle: jobRow.title,
      jobDescription: jobRow.description || '',
      requiredSkills: [...new Set([...top(matchedFreq, 15), ...hinted])].slice(0, 20),
      preferredSkills: top(missingFreq, 10),
      experienceLevel: typeof body.experience_level === 'string' ? body.experience_level : '',
      educationRequirements: typeof body.education === 'string' ? body.education : '',
      questionTypes,
      difficulty,
      defaultMarks: typeof body.marks_per_question === 'number' && body.marks_per_question > 0
        ? Math.min(20, Math.floor(Number(body.marks_per_question)))
        : 2,
    },
    title: jobRow.title,
    description: jobRow.description || '',
  };
}

async function insertGeneratedQuestions(
  assessmentId: string,
  questions: NormalizedGeneratedQuestion[],
  startPosition: number,
) {
  const supabase = getSupabaseClient();
  const rows = questions.map((q, index) => ({
    assessment_id: assessmentId,
    type: q.type,
    position: startPosition + index,
    title: q.title,
    prompt: q.prompt,
    payload: q.payload,
    marks: q.marks,
    skill_tag: q.skill_tag,
    is_required: q.is_required,
  }));
  const { data, error } = await supabase
    .from('assessment_questions')
    .insert(rows)
    .select('*');
  if (error || !data) {
    throw new AppError(`Failed to save generated questions: ${error?.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
  return data;
}

/**
 * POST /assessments/generate — AI-draft an assessment for a JOB.
 * Reuses the job's existing draft template when present (one template
 * per job); otherwise creates it. Output is ALWAYS draft for recruiter
 * review — never published, never sent.
 */
export const generateAssessmentHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = req.recruiter?.id as string;
  const body = (req.body || {}) as Record<string, unknown>;
  const jobId = String(body.job_id || '').trim();
  if (!jobId) {
    throw new AppError('job_id is required.', 400, ErrorCodes.VALIDATION_ERROR);
  }
  const { request, title } = await buildGenerationContext(recruiterId, jobId, body);

  let generated;
  try {
    generated = await generateAssessmentQuestions(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Assessment generation failed.';
    throw new AppError(message, 502, ErrorCodes.AI_ERROR);
  }

  const supabase = getSupabaseClient();
  const stageId = await ensureAssessmentStage(recruiterId, jobId);

  // One template per job: reuse the most recent draft without sent invites.
  let assessmentId: string | null = null;
  const { data: drafts } = await supabase
    .from('assessments')
    .select('id')
    .eq('recruiter_id', recruiterId)
    .eq('job_id', jobId)
    .eq('status', 'draft')
    .order('updated_at', { ascending: false })
    .limit(5);
  for (const d of (drafts || []) as Array<{ id: string }>) {
    const { count } = await supabase
      .from('assessment_invites')
      .select('id', { count: 'exact', head: true })
      .eq('assessment_id', d.id);
    if (!count) {
      assessmentId = d.id;
      break;
    }
  }
  if (!assessmentId) {
    const duration = typeof body.duration_minutes === 'number' && body.duration_minutes > 0
      ? Math.min(480, Math.floor(Number(body.duration_minutes)))
      : 60;
    const passing = typeof body.passing_score === 'number' && body.passing_score >= 0
      ? Number(body.passing_score)
      : 60;
    const { data: created, error: createError } = await supabase
      .from('assessments')
      .insert({
        recruiter_id: recruiterId,
        job_id: jobId,
        hiring_stage_id: stageId,
        name: `${title} — Assessment`,
        description: 'AI-generated draft. Review and edit before publishing.',
        instructions: '',
        duration_minutes: duration,
        passing_score: passing,
        skills: request.requiredSkills,
        status: 'draft',
        settings: DEFAULT_SETTINGS,
      })
      .select('id')
      .single();
    if (createError || !created) {
      throw new AppError(`Failed to create draft assessment: ${createError?.message}`, 500, ErrorCodes.DATABASE_ERROR);
    }
    assessmentId = (created as { id: string }).id;
  }

  const existing = await getQuestions(assessmentId);
  const startPosition = existing.length === 0 ? 0 : Math.max(...existing.map((q) => q.position)) + 1;
  const saved = await insertGeneratedQuestions(assessmentId, generated.questions, startPosition);

  await supabase
    .from('assessments')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', assessmentId);
  broadcast('assessment:updated', { assessmentId });
  logActivity({
    recruiterId,
    actionType: 'assessment_generated',
    description: `AI generated ${saved.length} draft questions for "${title}"`,
    metadata: { assessmentId, jobId, model: generated.model, dropped: generated.dropped },
  }).catch(() => {});

  res.status(201).json({
    success: true,
    data: { assessmentId, questions: saved, model: generated.model, dropped: generated.dropped },
  });
});

/**
 * POST /assessments/:assessmentId/questions/:questionId/regenerate —
 * replace one draft question with a freshly generated one of the same
 * (or requested) type. Draft-only; publish gate unchanged.
 */
export const regenerateQuestionHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiterId = req.recruiter?.id as string;
  const assessmentId = req.params.assessmentId as string;
  const questionId = req.params.questionId as string;
  const assessment = await requireAssessment(recruiterId, assessmentId);
  requireDraft(assessment);
  if (!assessment.job_id) {
    throw new AppError('Link this assessment to a job before regenerating with AI.', 400, ErrorCodes.VALIDATION_ERROR);
  }

  const supabase = getSupabaseClient();
  const { data: current } = await supabase
    .from('assessment_questions')
    .select('*')
    .eq('id', questionId)
    .eq('assessment_id', assessmentId)
    .maybeSingle();
  if (!current) {
    throw new AppError('Question not found', 404, ErrorCodes.NOT_FOUND);
  }
  const row = current as QuestionRow;

  const requestedType = String((req.body as Record<string, unknown>)?.type || row.type);
  if (!(GENERATION_TYPES as readonly string[]).includes(requestedType)) {
    throw new AppError('Invalid question type for regeneration.', 400, ErrorCodes.VALIDATION_ERROR);
  }

  const { request } = await buildGenerationContext(recruiterId, assessment.job_id, {
    question_types: { [requestedType]: 1 },
    difficulty: 'mixed',
    marks_per_question: row.marks,
  });
  let generated;
  try {
    generated = await generateAssessmentQuestions(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Question regeneration failed.';
    throw new AppError(message, 502, ErrorCodes.AI_ERROR);
  }
  const fresh = generated.questions[0];

  const { data: updated, error } = await supabase
    .from('assessment_questions')
    .update({
      type: fresh.type,
      title: fresh.title,
      prompt: fresh.prompt,
      payload: fresh.payload,
      marks: fresh.marks,
      skill_tag: fresh.skill_tag || row.skill_tag,
    })
    .eq('id', questionId)
    .eq('assessment_id', assessmentId)
    .select('*')
    .single();
  if (error || !updated) {
    throw new AppError(`Failed to save regenerated question: ${error?.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
  broadcast('assessment:updated', { assessmentId });
  res.status(200).json({ success: true, data: updated });
});

// Re-exported for tests (pure helpers stay importable without Express).
export const __testables = {
  isQuestionType,
  fingerprint: (value: string) => crypto.createHash('sha256').update(value).digest('hex').slice(0, 8),
};
