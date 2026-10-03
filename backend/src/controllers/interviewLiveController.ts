import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { getSupabaseClient } from '@/services/supabase/client';
import { AppError } from '@/middleware/errorHandler';
import { ErrorCodes } from '@/middleware/errorCodes';
import { runVisibleCode, executionMode } from '@/services/codeExecution';
import { validateRunInput } from '@/services/codeExecution/types';
import { normalizeLanguage } from '@/services/codeExecution/languages';
import { broadcast } from '@/services/websocket';

async function requireOwnedInterview(recruiterId: string, interviewId: string) {
  const supabase = getSupabaseClient();
  const { data: interview } = await supabase.from('interviews').select('id, candidate_id, status').eq('id', interviewId).maybeSingle();
  if (!interview) throw new AppError('Interview not found', 404, ErrorCodes.NOT_FOUND);
  const row = interview as { id: string; candidate_id: string; status: string };
  const { data: cand } = await supabase.from('candidates').select('recruiter_id').eq('id', row.candidate_id).maybeSingle();
  if (!cand || (cand as { recruiter_id: string }).recruiter_id !== recruiterId) {
    throw new AppError('Interview not found', 404, ErrorCodes.NOT_FOUND);
  }
  return row;
}

async function getOrCreateSession(interviewId: string) {
  const supabase = getSupabaseClient();
  const { data } = await supabase.from('interview_coding_sessions').select('*').eq('interview_id', interviewId).maybeSingle();
  if (data) return data as Record<string, unknown>;
  const { data: created, error } = await supabase
    .from('interview_coding_sessions')
    .insert({ interview_id: interviewId })
    .select('*')
    .single();
  if (error || !created) throw new AppError('Could not init coding session', 500, ErrorCodes.DATABASE_ERROR);
  return created as Record<string, unknown>;
}

function safeSessionView(session: Record<string, unknown>, problem: Record<string, unknown> | null) {
  return {
    interview_id: session.interview_id,
    problem: problem ? { id: problem.id, title: problem.title, description: problem.description, languages: problem.languages } : null,
    language: session.language,
    starter_code: session.starter_code,
    candidate_code: session.candidate_code,
    run_state: session.run_state,
    output: session.output,
    session_state: session.session_state,
    version: session.version,
    updated_at: session.updated_at,
    executionMode: executionMode().provider,
  };
}

// GET /interviews/problems — reusable prompts.
export const listInterviewProblemsHandler = asyncHandler(async (_req: Request, res: Response) => {
  const supabase = getSupabaseClient();
  const { data } = await supabase.from('interview_problems').select('id, title, description, starter_code, languages').order('created_at', { ascending: true });
  res.json({ success: true, data: data || [] });
});

// GET /interviews/:interviewId/coding-session — recruiter full view.
export const getCodingSessionHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiter = req.recruiter;
  if (!recruiter) throw new AppError('Unauthorized', 401, ErrorCodes.NOT_FOUND);
  const interviewId = String((req.params as Record<string, unknown>).interviewId || '');
  await requireOwnedInterview(recruiter.id, interviewId);
  const session = await getOrCreateSession(interviewId);
  const supabase = getSupabaseClient();
  let problem: Record<string, unknown> | null = null;
  if (session.problem_id) {
    const { data } = await supabase.from('interview_problems').select('*').eq('id', session.problem_id as string).maybeSingle();
    problem = (data as Record<string, unknown> | null) || null;
  }
  res.json({ success: true, data: { ...safeSessionView(session, problem), problem_id: session.problem_id } });
});

// POST /interviews/:interviewId/coding-session/problem { problemId } — push/replace.
export const pushCodingProblemHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiter = req.recruiter;
  if (!recruiter) throw new AppError('Unauthorized', 401, ErrorCodes.NOT_FOUND);
  const interviewId = String((req.params as Record<string, unknown>).interviewId || '');
  const owned = await requireOwnedInterview(recruiter.id, interviewId);
  if (owned.status === 'completed' || owned.status === 'cancelled') {
    throw new AppError('Interview already ended', 409, ErrorCodes.VALIDATION_ERROR);
  }
  const problemId = String(req.body?.problemId || '');
  if (!problemId) throw new AppError('problemId is required', 400, ErrorCodes.VALIDATION_ERROR);
  const supabase = getSupabaseClient();
  const { data: problem } = await supabase.from('interview_problems').select('*').eq('id', problemId).maybeSingle();
  if (!problem) throw new AppError('Problem not found', 404, ErrorCodes.NOT_FOUND);
  const p = problem as Record<string, unknown>;
  const session = await getOrCreateSession(interviewId);
  const nextVersion = Number(session.version || 1) + 1;
  const starter = String(p.starter_code || '');
  await supabase
    .from('interview_coding_sessions')
    .update({
      problem_id: problemId,
      language: 'javascript',
      starter_code: starter,
      candidate_code: starter,
      run_state: 'idle',
      output: {},
      session_state: 'live',
      version: nextVersion,
      updated_at: new Date().toISOString(),
    })
    .eq('interview_id', interviewId);
  try {
    broadcast('interview:coding', { interviewId, type: 'problem', version: nextVersion, problemId });
  } catch { /* best-effort */ }
  res.json({ success: true, data: { version: nextVersion } });
});

// POST /interviews/:interviewId/coding-session/reset — reset to starter.
export const resetCodingSessionHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiter = req.recruiter;
  if (!recruiter) throw new AppError('Unauthorized', 401, ErrorCodes.NOT_FOUND);
  const interviewId = String((req.params as Record<string, unknown>).interviewId || '');
  const owned = await requireOwnedInterview(recruiter.id, interviewId);
  if (owned.status === 'completed' || owned.status === 'cancelled') {
    throw new AppError('Interview already ended', 409, ErrorCodes.VALIDATION_ERROR);
  }
  const session = await getOrCreateSession(interviewId);
  const supabase = getSupabaseClient();
  const nextVersion = Number(session.version || 1) + 1;
  await supabase
    .from('interview_coding_sessions')
    .update({
      candidate_code: String(session.starter_code || ''),
      run_state: 'idle',
      output: {},
      version: nextVersion,
      updated_at: new Date().toISOString(),
    })
    .eq('interview_id', interviewId);
  try {
    broadcast('interview:coding', { interviewId, type: 'reset', version: nextVersion });
  } catch { /* best-effort */ }
  res.json({ success: true, data: { version: nextVersion } });
});

async function runSessionCode(interviewId: string, sourceCode: string, stdin: string, language: string) {
  const supabase = getSupabaseClient();
  await supabase.from('interview_coding_sessions').update({ run_state: 'running', updated_at: new Date().toISOString() }).eq('interview_id', interviewId);
  try {
    broadcast('interview:coding', { interviewId, type: 'run_started' });
  } catch { /* best-effort */ }
  const checked = validateRunInput({ language, sourceCode, stdin, visibleTests: [] });
  if (checked.errors.length > 0) {
    await supabase
      .from('interview_coding_sessions')
      .update({ run_state: 'failed', output: { stderr: checked.errors.join(' ') }, updated_at: new Date().toISOString() })
      .eq('interview_id', interviewId);
    return { ok: false, output: { stderr: checked.errors.join(' ') } };
  }
  try {
    const result = await runVisibleCode({ language: checked.language, sourceCode, stdin, visibleTests: [] });
    const output = { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode, provider: result.provider, isMock: result.isMock };
    await supabase
      .from('interview_coding_sessions')
      .update({ run_state: 'succeeded', output, updated_at: new Date().toISOString() })
      .eq('interview_id', interviewId);
    try {
      broadcast('interview:coding', { interviewId, type: 'run_finished', output });
    } catch { /* best-effort */ }
    return { ok: true, output };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Execution failed';
    await supabase
      .from('interview_coding_sessions')
      .update({ run_state: 'failed', output: { stderr: message }, updated_at: new Date().toISOString() })
      .eq('interview_id', interviewId);
    return { ok: false, output: { stderr: message } };
  }
}

// POST /interviews/:interviewId/coding-session/run — interviewer runs candidate code.
export const runCodingSessionHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiter = req.recruiter;
  if (!recruiter) throw new AppError('Unauthorized', 401, ErrorCodes.NOT_FOUND);
  const interviewId = String((req.params as Record<string, unknown>).interviewId || '');
  await requireOwnedInterview(recruiter.id, interviewId);
  const session = await getOrCreateSession(interviewId);
  if (String(session.session_state || '') === 'ended') throw new AppError('Interview already ended', 409, ErrorCodes.VALIDATION_ERROR);
  const stdin = String(req.body?.stdin || '').slice(0, 16384);
  const result = await runSessionCode(interviewId, String(session.candidate_code || ''), stdin, String(session.language || 'javascript'));
  res.json({ success: true, data: result.output });
});

// POST /interviews/:interviewId/end — end interview (persist final code state).
export const endInterviewHandler = asyncHandler(async (req: Request, res: Response) => {
  const recruiter = req.recruiter;
  if (!recruiter) throw new AppError('Unauthorized', 401, ErrorCodes.NOT_FOUND);
  const interviewId = String((req.params as Record<string, unknown>).interviewId || '');
  await requireOwnedInterview(recruiter.id, interviewId);
  const supabase = getSupabaseClient();
  await supabase.from('interviews').update({ status: 'completed' }).eq('id', interviewId);
  await supabase.from('interview_coding_sessions').update({ session_state: 'ended', updated_at: new Date().toISOString() }).eq('interview_id', interviewId);
  try {
    broadcast('interview:coding', { interviewId, type: 'ended' });
    broadcast('interview:updated', { interviewId, status: 'completed' });
  } catch { /* best-effort */ }
  res.json({ success: true, data: { ended: true } });
});

// ---------- Candidate side (session auth) ----------

async function requireCandidateInterview(req: Request) {
  const ctx = req.candidate;
  if (!ctx || ctx.scope !== 'interview' || !ctx.interviewInviteId) {
    throw new AppError('No interview session', 401, ErrorCodes.NOT_FOUND);
  }
  const supabase = getSupabaseClient();
  const { data: invite } = await supabase
    .from('interview_invites')
    .select('id, interview_id, candidate_id, status')
    .eq('id', ctx.interviewInviteId)
    .maybeSingle();
  if (!invite) throw new AppError('Invite not found', 404, ErrorCodes.NOT_FOUND);
  const inv = invite as { interview_id: string; candidate_id: string; status: string };
  if (inv.candidate_id !== ctx.candidateId) throw new AppError('Forbidden', 403, ErrorCodes.NOT_FOUND);
  if (inv.status === 'revoked') throw new AppError('Invitation revoked', 410, ErrorCodes.NOT_FOUND);
  const { data: interview } = await supabase.from('interviews').select('id, status').eq('id', inv.interview_id).maybeSingle();
  if (!interview) throw new AppError('Interview not found', 404, ErrorCodes.NOT_FOUND);
  if (String((interview as { status: string }).status) === 'cancelled') {
    throw new AppError('Interview cancelled', 410, ErrorCodes.NOT_FOUND);
  }
  // Mark joined on first session read (best-effort, never blocks).
  try {
    if (String((interview as { status: string }).status) === 'scheduled') {
      await supabase.from('interviews').update({ status: 'joined' }).eq('id', inv.interview_id);
      try { broadcast('interview:updated', { interviewId: inv.interview_id, status: 'joined' }); } catch { /* noop */ }
    }
  } catch { /* best-effort */ }
  return inv.interview_id;
}

// GET /candidate/interview/coding-session — safe view.
export const getCandidateCodingSessionHandler = asyncHandler(async (req: Request, res: Response) => {
  const interviewId = await requireCandidateInterview(req);
  const session = await getOrCreateSession(interviewId);
  const supabase = getSupabaseClient();
  let problem: Record<string, unknown> | null = null;
  if (session.problem_id) {
    const { data } = await supabase.from('interview_problems').select('id, title, description, languages').eq('id', session.problem_id as string).maybeSingle();
    problem = (data as Record<string, unknown> | null) || null;
  }
  const { data: interview } = await supabase.from('interviews').select('status, scheduled_date, scheduled_time, meeting_link').eq('id', interviewId).maybeSingle();
  res.json({ success: true, data: { ...safeSessionView(session, problem), interview } });
});

// PATCH /candidate/interview/coding-session/code { code, version }
export const updateCandidateCodeHandler = asyncHandler(async (req: Request, res: Response) => {
  const interviewId = await requireCandidateInterview(req);
  const code = String(req.body?.code ?? '');
  if (Buffer.byteLength(code, 'utf8') > 64 * 1024) throw new AppError('Code too large', 400, ErrorCodes.VALIDATION_ERROR);
  const clientVersion = Number(req.body?.version || 0);
  const session = await getOrCreateSession(interviewId);
  if (String(session.session_state || '') === 'ended') throw new AppError('Interview already ended', 409, ErrorCodes.VALIDATION_ERROR);
  const currentVersion = Number(session.version || 1);
  // Duplicate / stale event: client is behind — return truth without writing.
  if (clientVersion > 0 && clientVersion < currentVersion) {
    res.json({ success: true, data: { deduplicated: true, version: currentVersion, candidate_code: session.candidate_code } });
    return;
  }
  const supabase = getSupabaseClient();
  const nextVersion = currentVersion + 1;
  await supabase
    .from('interview_coding_sessions')
    .update({ candidate_code: code, version: nextVersion, updated_at: new Date().toISOString() })
    .eq('interview_id', interviewId);
  try {
    broadcast('interview:coding', { interviewId, type: 'code', version: nextVersion });
  } catch { /* best-effort */ }
  res.json({ success: true, data: { version: nextVersion } });
});

// POST /candidate/interview/coding-session/run { stdin? }
export const runCandidateCodeHandler = asyncHandler(async (req: Request, res: Response) => {
  const interviewId = await requireCandidateInterview(req);
  const session = await getOrCreateSession(interviewId);
  if (String(session.session_state || '') === 'ended') throw new AppError('Interview already ended', 409, ErrorCodes.VALIDATION_ERROR);
  const lang = normalizeLanguage(String(session.language || 'javascript')) || 'javascript';
  const stdin = String(req.body?.stdin || '').slice(0, 16384);
  const result = await runSessionCode(interviewId, String(session.candidate_code || ''), stdin, lang);
  res.json({ success: true, data: result.output });
});
