import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { getSupabaseClient } from '@/services/supabase/client';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import { logger } from '@/utils/logger';
import { isWindowExpired } from '@/services/assessments/inviteCrypto';
import { sanitizeQuestions } from '@/services/assessments/sanitize';
import { scoreQuestion, computeTotals, isPassing } from '@/services/assessments/scoring';
import { runVisibleCode, evaluateCodeSubmission, executionMode } from '@/services/codeExecution';
import { validateRunInput } from '@/services/codeExecution/types';
import { normalizeLanguage } from '@/services/codeExecution/languages';
import {
  createCandidateSession,
  sessionCookieHeader,
  verifyCandidateSession,
  parseCookies,
} from '@/services/hiring/candidateSession';
import { lookupInviteByToken, requireOwnedAttempt } from '@/middleware/candidateAuth';
import { enqueueProgressionJob } from '@/services/queue/progressionQueue';

/**
 * Candidate-side assessment (token -> session cookie, autosave, submit).
 * Every handler scopes by req.candidate (session) — never trusts
 * body-provided candidate/attempt ownership IDs.
 */

// ---------- helpers ----------

async function getAssessmentWithQuestions(assessmentId: string) {
  const supabase = getSupabaseClient();
  const { data: assessment, error: aErr } = await supabase
    .from('assessments')
    .select('id, job_id, recruiter_id, name, description, instructions, duration_minutes, passing_score, status, available_from, available_until, settings')
    .eq('id', assessmentId)
    .maybeSingle();
  if (aErr) throw new AppError(`Failed to load assessment: ${aErr.message}`, 500, ErrorCodes.DATABASE_ERROR);
  if (!assessment) throw new AppError('Assessment not found', 404, ErrorCodes.NOT_FOUND);
  if ((assessment as { status: string }).status !== 'published') {
    throw new AppError('Assessment is not available', 410, ErrorCodes.NOT_FOUND);
  }
  const { data: questions, error: qErr } = await supabase
    .from('assessment_questions')
    .select('id, assessment_id, type, position, title, prompt, payload, marks, skill_tag, is_required')
    .eq('assessment_id', assessmentId)
    .order('position', { ascending: true });
  if (qErr) throw new AppError(`Failed to load questions: ${qErr.message}`, 500, ErrorCodes.DATABASE_ERROR);
  return { assessment, questions: (questions || []) as Array<Record<string, unknown> & { id: string; type: string; marks: number; payload: Record<string, unknown> }> };
}

async function getOrCreateActiveAttempt(assessmentId: string, candidateId: string, inviteId: string) {
  const supabase = getSupabaseClient();
  const { data: active } = await supabase
    .from('assessment_attempts')
    .select('*')
    .eq('assessment_id', assessmentId)
    .eq('candidate_id', candidateId)
    .eq('status', 'in_progress')
    .maybeSingle();
  if (active) return active as Record<string, unknown> & { id: string };

  // Next attempt_number (history preserved, correction #7).
  const { data: latest } = await supabase
    .from('assessment_attempts')
    .select('attempt_number')
    .eq('assessment_id', assessmentId)
    .eq('candidate_id', candidateId)
    .order('attempt_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextNumber = ((latest as { attempt_number?: number } | null)?.attempt_number || 0) + 1;

  // Expiry from assessment duration.
  const { data: assessment } = await supabase
    .from('assessments')
    .select('duration_minutes')
    .eq('id', assessmentId)
    .maybeSingle();
  const durationMin = Number((assessment as { duration_minutes?: number } | null)?.duration_minutes || 60);
  const expiresAt = new Date(Date.now() + durationMin * 60_000).toISOString();

  const { data, error } = await supabase
    .from('assessment_attempts')
    .insert({
      assessment_id: assessmentId,
      candidate_id: candidateId,
      invite_id: inviteId,
      attempt_number: nextNumber,
      status: 'in_progress',
      expires_at: expiresAt,
    })
    .select('*')
    .single();
  if (error) {
    // Race: another request created the active attempt first.
    if ((error as { code?: string }).code === '23505') {
      const { data: raced } = await supabase
        .from('assessment_attempts')
        .select('*')
        .eq('assessment_id', assessmentId)
        .eq('candidate_id', candidateId)
        .eq('status', 'in_progress')
        .maybeSingle();
      if (raced) return raced as Record<string, unknown> & { id: string };
    }
    throw new AppError(`Failed to start attempt: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);
  }
  return data as Record<string, unknown> & { id: string };
}

// ---------- 1. Token exchange: POST /candidate/assessment/exchange { token } ----------
// Validates the opaque invite token ONCE, creates attempt + session,
// sets HttpOnly cookie. Public (no session yet).

export const exchangeTokenHandler = asyncHandler(async (req: Request, res: Response) => {
  const token = String(req.body?.token || '').trim();
  if (!token) throw new AppError('token is required', 400, ErrorCodes.VALIDATION_ERROR);

  const invite = await lookupInviteByToken(token);
  if (!invite) throw new AppError('Invalid invitation link', 404, ErrorCodes.NOT_FOUND);
  if (invite.status === 'revoked') throw new AppError('Invitation revoked', 410, ErrorCodes.NOT_FOUND);
  if (invite.status === 'expired' || isWindowExpired(invite.available_until)) {
    throw new AppError('Invitation window expired', 410, ErrorCodes.NOT_FOUND);
  }

  const { assessment } = await getAssessmentWithQuestions(invite.assessment_id);
  if (isWindowExpired((assessment as { available_until?: string | null }).available_until)) {
    throw new AppError('Assessment window expired', 410, ErrorCodes.NOT_FOUND);
  }

  const attempt = await getOrCreateActiveAttempt(invite.assessment_id, invite.candidate_id, invite.id);

  // Mark invite opened/started (best-effort, never blocks).
  const supabase = getSupabaseClient();
  if (invite.status === 'sent') {
    await supabase.from('assessment_invites').update({ status: 'opened' }).eq('id', invite.id);
  }

  const { token: sessionToken, expiresAt } = await createCandidateSession({
    candidateId: invite.candidate_id,
    inviteId: invite.id,
    scope: 'assessment',
  });

  res.setHeader('Set-Cookie', sessionCookieHeader(sessionToken, expiresAt));
  res.json({
    success: true,
    data: {
      attemptId: (attempt as { id: string }).id,
      assessmentId: invite.assessment_id,
      expiresAt: (attempt as { expires_at?: string }).expires_at || null,
    },
  });
});

// ---------- 2. GET /candidate/assessment (sanitized, session auth) ----------

export const getAssessmentHandler = asyncHandler(async (req: Request, res: Response) => {
  const ctx = req.candidate;
  if (!ctx?.assessmentId) throw new AppError('No active assessment session', 401, ErrorCodes.NOT_FOUND);
  const { assessment, questions } = await getAssessmentWithQuestions(ctx.assessmentId);
  const safe = sanitizeQuestions(questions as unknown as Parameters<typeof sanitizeQuestions>[0]);

  // Resume active attempt + saved answers.
  const supabase = getSupabaseClient();
  const { data: attempt } = await supabase
    .from('assessment_attempts')
    .select('id, status, started_at, expires_at, attempt_number')
    .eq('assessment_id', ctx.assessmentId)
    .eq('candidate_id', ctx.candidateId)
    .eq('status', 'in_progress')
    .maybeSingle();
  let answers: Array<Record<string, unknown>> = [];
  if (attempt) {
    const { data: rows } = await supabase
      .from('assessment_answers')
      .select('question_id, answer, language, updated_at')
      .eq('attempt_id', (attempt as { id: string }).id);
    answers = (rows || []) as Array<Record<string, unknown>>;
  }

  res.json({
    success: true,
    data: {
      assessment: {
        id: (assessment as { id: string }).id,
        name: (assessment as { name: string }).name,
        description: (assessment as { description: string }).description,
        instructions: (assessment as { instructions: string }).instructions,
        duration_minutes: (assessment as { duration_minutes: number }).duration_minutes,
        settings: (assessment as { settings: unknown }).settings,
      },
      questions: safe,
      attempt,
      answers,
    },
  });
});

// ---------- 3. Autosave: PATCH /candidate/attempts/:attemptId/answers ----------

export const saveAnswerHandler = asyncHandler(async (req: Request, res: Response) => {
  const ctx = req.candidate;
  if (!ctx) throw new AppError('Candidate session required', 401, ErrorCodes.NOT_FOUND);
  const attemptId = String((req.params as Record<string, unknown>).attemptId || "");
  const { questionId, answer, language, code } = req.body || {};
  if (!questionId || typeof questionId !== 'string') {
    throw new AppError('questionId is required', 400, ErrorCodes.VALIDATION_ERROR);
  }

  const attempt = await requireOwnedAttempt(ctx.candidateId, attemptId, ctx.assessmentId);
  if (attempt.status !== 'in_progress') {
    throw new AppError('Attempt is no longer active', 409, ErrorCodes.VALIDATION_ERROR);
  }
  if (attempt.expires_at && new Date(attempt.expires_at as string).getTime() <= Date.now()) {
    throw new AppError('Attempt expired', 410, ErrorCodes.VALIDATION_ERROR);
  }

  // Verify question belongs to this assessment.
  const supabase = getSupabaseClient();
  const { data: question } = await supabase
    .from('assessment_questions')
    .select('id, assessment_id, type')
    .eq('id', questionId)
    .maybeSingle();
  if (!question || (question as { assessment_id: string }).assessment_id !== attempt.assessment_id) {
    throw new AppError('Invalid question for this assessment', 400, ErrorCodes.VALIDATION_ERROR);
  }

  const safeAnswer = answer !== undefined ? answer : {};
  const { error } = await supabase.from('assessment_answers').upsert(
    {
      attempt_id: attemptId,
      question_id: questionId,
      answer: typeof safeAnswer === 'object' && safeAnswer !== null ? safeAnswer : { value: safeAnswer },
      language: typeof language === 'string' ? language.slice(0, 50) : null,
      code: typeof code === 'string' ? code.slice(0, 64 * 1024) : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'attempt_id,question_id' },
  );
  if (error) throw new AppError(`Failed to save answer: ${error.message}`, 500, ErrorCodes.DATABASE_ERROR);
  res.json({ success: true, data: { saved: true } });
});

// ---------- 4. Run Code: POST /candidate/attempts/:attemptId/code/run ----------
// Visible tests ONLY. Never scores, never hidden tests (correction #5).

export const runCodeHandler = asyncHandler(async (req: Request, res: Response) => {
  const ctx = req.candidate;
  if (!ctx) throw new AppError('Candidate session required', 401, ErrorCodes.NOT_FOUND);
  const attemptId = String((req.params as Record<string, unknown>).attemptId || "");
  const attempt = await requireOwnedAttempt(ctx.candidateId, attemptId, ctx.assessmentId);
  if (attempt.status !== 'in_progress') {
    throw new AppError('Attempt is no longer active', 409, ErrorCodes.VALIDATION_ERROR);
  }

  const { questionId, language, sourceCode, stdin } = req.body || {};
  if (!questionId) throw new AppError('questionId is required', 400, ErrorCodes.VALIDATION_ERROR);

  const supabase = getSupabaseClient();
  const { data: question } = await supabase
    .from('assessment_questions')
    .select('id, assessment_id, type, payload')
    .eq('id', questionId)
    .maybeSingle();
  if (!question || (question as { assessment_id: string }).assessment_id !== attempt.assessment_id) {
    throw new AppError('Invalid question for this assessment', 400, ErrorCodes.VALIDATION_ERROR);
  }
  if ((question as { type: string }).type !== 'coding') {
    throw new AppError('This endpoint only supports coding questions', 400, ErrorCodes.VALIDATION_ERROR);
  }

  const normalized = normalizeLanguage(language);
  if (!normalized) throw new AppError('Invalid language. Allowed: javascript.', 400, ErrorCodes.VALIDATION_ERROR);

  // Visible tests ONLY — hidden cases are stripped here by construction.
  const payload = (question as { payload: Record<string, unknown> }).payload || {};
  const allCases = Array.isArray(payload.test_cases) ? payload.test_cases : [];
  const visibleTests = (allCases as Array<Record<string, unknown>>)
    .filter((t) => t && t.is_hidden !== true)
    .slice(0, 5)
    .map((t) => ({ input: typeof t.input === 'string' ? t.input : '' }));

  const checked = validateRunInput({ language: normalized, sourceCode, stdin, visibleTests });
  if (checked.errors.length > 0) {
    throw new AppError(checked.errors.join('; '), 400, ErrorCodes.VALIDATION_ERROR);
  }

  try {
    const result = await runVisibleCode({
      language: checked.language,
      sourceCode: checked.sourceCode,
      stdin: checked.stdin,
      visibleTests: checked.visibleTests,
    });
    // Sanitize output size.
    result.stdout = result.stdout.slice(0, 32_768);
    result.stderr = result.stderr.slice(0, 32_768);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.warn('[runCode] provider failure', { error: err instanceof Error ? err.message : String(err) });
    throw new AppError('Code execution temporarily unavailable', 502, ErrorCodes.INTERNAL_ERROR);
  }
});

// ---------- 5. Submit: POST /candidate/attempts/:attemptId/submit ----------
// Atomic persist (score/result/eligibility), then async progression job.
// Correction #2: no giant transaction across email/provider calls.

export const submitAttemptHandler = asyncHandler(async (req: Request, res: Response) => {
  const ctx = req.candidate;
  if (!ctx) throw new AppError('Candidate session required', 401, ErrorCodes.NOT_FOUND);
  const attemptId = String((req.params as Record<string, unknown>).attemptId || "");
  const supabase = getSupabaseClient();

  const attempt = await requireOwnedAttempt(ctx.candidateId, attemptId, ctx.assessmentId);

  // Idempotent: already submitted/evaluated returns current result.
  if (attempt.status === 'submitted' || attempt.status === 'evaluated') {
    const { data: existing } = await supabase
      .from('assessment_attempts')
      .select('id, status, score, max_score, percentage, passed, submitted_at')
      .eq('id', attemptId)
      .maybeSingle();
    res.json({ success: true, data: { ...(existing as object), deduplicated: true } });
    return;
  }
  if (attempt.status !== 'in_progress') {
    throw new AppError('Attempt is no longer active', 409, ErrorCodes.VALIDATION_ERROR);
  }

  // Load assessment + questions + answers atomically (read set).
  const { data: assessment } = await supabase
    .from('assessments')
    .select('id, job_id, recruiter_id, passing_score, name')
    .eq('id', attempt.assessment_id)
    .maybeSingle();
  if (!assessment) throw new AppError('Assessment not found', 404, ErrorCodes.NOT_FOUND);

  const { data: questions } = await supabase
    .from('assessment_questions')
    .select('id, type, marks, payload')
    .eq('assessment_id', attempt.assessment_id)
    .order('position', { ascending: true });

  const { data: answers } = await supabase
    .from('assessment_answers')
    .select('question_id, answer, language, code')
    .eq('attempt_id', attemptId);

  const answerMap = new Map<string, Record<string, unknown>>();
  for (const a of (answers || []) as Array<{ question_id: string; answer: unknown; language: string | null; code: string | null }>) {
    answerMap.set(a.question_id, {
      ...(typeof a.answer === 'object' && a.answer !== null ? (a.answer as Record<string, unknown>) : { value: a.answer }),
      _language: a.language,
      _code: a.code,
    });
  }

  // Score each question. Coding uses server-side hidden evaluation.
  const mode = executionMode();
  const perQuestion: Array<{ questionId: string; score: number | null; maxScore: number; isCorrect: boolean | null }> = [];
  let mockBlocked = false;

  for (const q of (questions || []) as Array<{ id: string; type: string; marks: number; payload: Record<string, unknown> }>) {
    const ans = answerMap.get(q.id) || null;
    if (q.type === 'coding') {
      const hiddenTests = (Array.isArray(q.payload.test_cases) ? q.payload.test_cases : [])
        .filter((t: unknown) => t && typeof t === 'object')
        .map((t: unknown) => {
          const rec = t as Record<string, unknown>;
          return {
            input: typeof rec.input === 'string' ? rec.input : '',
            expected_output: typeof rec.expected_output === 'string' ? rec.expected_output : '',
          };
        });
      const code = String((ans as Record<string, unknown> | null)?._code || (ans as Record<string, unknown> | null)?.code || '');
      const language = normalizeLanguage(
        (ans as Record<string, unknown> | null)?._language || q.payload.language || 'javascript',
      ) || 'javascript';
      if (!code.trim()) {
        perQuestion.push({ questionId: q.id, score: 0, maxScore: Number(q.marks) || 0, isCorrect: false });
        continue;
      }
      try {
        const evalResult = await evaluateCodeSubmission({ language, sourceCode: code, hiddenTests });
        if (evalResult.untrustworthy) {
          // Correction #6: mock must never create a real pass.
          mockBlocked = true;
          perQuestion.push({ questionId: q.id, score: null, maxScore: Number(q.marks) || 0, isCorrect: null });
          continue;
        }
        const s = scoreQuestion({
          type: 'coding',
          marks: Number(q.marks) || 0,
          payload: q.payload,
          answer: ans,
          hiddenPassed: evalResult.hiddenPassed,
          hiddenTotal: evalResult.hiddenTotal,
        });
        perQuestion.push({ questionId: q.id, score: s.score, maxScore: s.maxScore, isCorrect: s.isCorrect });
      } catch (err) {
        logger.warn('[submit] code eval failed — scoring zero for question', { error: err instanceof Error ? err.message : String(err) });
        perQuestion.push({ questionId: q.id, score: 0, maxScore: Number(q.marks) || 0, isCorrect: false });
      }
    } else {
      const s = scoreQuestion({ type: q.type, marks: Number(q.marks) || 0, payload: q.payload, answer: ans });
      perQuestion.push({ questionId: q.id, score: s.score, maxScore: s.maxScore, isCorrect: s.isCorrect });
    }
  }

  if (mockBlocked) {
    // Persist as submitted WITHOUT a trusted score; progression halted.
    await supabase
      .from('assessment_attempts')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        is_mock_execution: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', attemptId);
    throw new AppError(
      'Code execution is not configured (mock mode). Scored submission is unavailable — contact your recruiter.',
      503,
      ErrorCodes.INTERNAL_ERROR,
    );
  }

  const totals = computeTotals({ scores: perQuestion.map((p) => ({ score: p.score, maxScore: p.maxScore, isCorrect: p.isCorrect })) });
  const passingPercent = Number((assessment as { passing_score?: number }).passing_score || 0);
  const passed = isPassing(totals.percentage, passingPercent);

  // ATOMIC persist: attempt result + per-answer scores. No email/provider calls here.
  for (const p of perQuestion) {
    await supabase
      .from('assessment_answers')
      .update({ score: p.score, max_score: p.maxScore, is_correct: p.isCorrect })
      .eq('attempt_id', attemptId)
      .eq('question_id', p.questionId);
  }
  const { error: persistError } = await supabase
    .from('assessment_attempts')
    .update({
      status: 'evaluated',
      submitted_at: new Date().toISOString(),
      score: totals.score,
      max_score: totals.maxScore,
      percentage: totals.percentage,
      passed,
      is_mock_execution: mode.isMock,
      updated_at: new Date().toISOString(),
    })
    .eq('id', attemptId)
    .eq('status', 'in_progress'); // guard: only transition from active (idempotent)

  // Mark invite completed (best-effort).
  const inviteId = (attempt as unknown as { invite_id?: string }).invite_id;
  if (inviteId) {
    await supabase.from('assessment_invites').update({ status: 'completed' }).eq('id', inviteId);
  }

  if (persistError) {
    // Likely a concurrent submit won — return its result (idempotent).
    const { data: current } = await supabase
      .from('assessment_attempts')
      .select('id, status, score, max_score, percentage, passed, submitted_at')
      .eq('id', attemptId)
      .maybeSingle();
    res.json({ success: true, data: { ...(current as object), deduplicated: true } });
    return;
  }

  // Enqueue progression (async, retryable — correction #2).
  const recruiterId = String((assessment as { recruiter_id?: string }).recruiter_id || '');
  const jobId = (assessment as { job_id?: string | null }).job_id || null;
  if (recruiterId) {
    await enqueueProgressionJob({
      candidateId: ctx.candidateId,
      jobId,
      recruiterId,
      fromStage: 'Assessment',
      triggerType: 'assessment_submission',
      triggerId: attemptId,
      passed,
      metadata: { percentage: totals.percentage, score: totals.score, maxScore: totals.maxScore },
    });
  }

  res.json({
    success: true,
    data: {
      id: attemptId,
      status: 'evaluated',
      score: totals.score,
      maxScore: totals.maxScore,
      percentage: totals.percentage,
      passed,
      deduplicated: false,
    },
  });
});

// ---------- 6. Session check: GET /candidate/session ----------

export const sessionCheckHandler = asyncHandler(async (req: Request, res: Response) => {
  const cookies = parseCookies(req.headers.cookie);
  const session = await verifyCandidateSession(cookies.hs_candidate || '');
  if (!session) {
    res.status(401).json({ success: false, error: 'No candidate session' });
    return;
  }
  res.json({ success: true, data: { candidateId: session.candidate_id, scope: session.scope } });
});
