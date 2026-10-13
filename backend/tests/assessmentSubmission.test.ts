import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FakeDb, makeClient } from './helpers/fakeSupabase';

/**
 * Assessment submission end to end, and the job-scoped progression it triggers.
 *
 * The regression this covers
 * ─────────────────────────
 * Two defects combined into one broken flow:
 *
 *  1. `supabase_setup.sql` — the documented provisioning path — defined
 *     `assessment_invites.status` WITHOUT `'completed'`. On a database built
 *     from that file alone, the update that marks an invite completed failed
 *     with a 23514. The return value was discarded, so the failure was silent:
 *     the attempt scored normally, the invite stayed `'sent'`, and the workspace
 *     showed a candidate who had finished as "Invited" forever.
 *
 *  2. Sending an invitation never moved the application out of `Shortlisted`.
 *     On submit, progression is enqueued with `fromStage: 'Assessment'` from the
 *     job payload; the central write path re-read the REAL stage (`Shortlisted`)
 *     and correctly rejected `Shortlisted → Technical Round` as a skipped stage.
 *     So every auto-advance failed with a 409.
 *
 * Together: a candidate could be invited, could submit, and could be scored —
 * and their pipeline would still read "Shortlisted / Invited" forever.
 */

const db = new FakeDb();

vi.mock('@/services/supabase/client', () => ({
  getSupabaseClient: () => makeClient(db),
}));

vi.mock('@/services/activity', () => ({
  logActivity: vi.fn(async () => undefined),
  ACTION_TYPE_VALUES: ['assessment_invite_sent'],
}));

const enqueuedEmails: Array<Record<string, unknown>> = [];
vi.mock('@/services/queue/emailQueue', () => ({
  enqueueEmail: vi.fn(async (p: Record<string, unknown>) => {
    enqueuedEmails.push(p);
    return { queued: true, deduplicated: false };
  }),
}));

const enqueuedProgressions: Array<Record<string, unknown>> = [];
vi.mock('@/services/queue/progressionQueue', () => ({
  enqueueProgressionJob: vi.fn(async (p: Record<string, unknown>) => {
    enqueuedProgressions.push(p);
    return { jobId: `prog-${enqueuedProgressions.length}`, deduplicated: false };
  }),
  progressionJobId: (t: string, i: string) => `prog-${t}-${i}`,
}));

// Scoring must be deterministic and offline.
vi.mock('@/services/codeExecution', () => ({
  executionMode: () => ({ provider: 'judge0', isMock: false, judge0Configured: true }),
  runVisibleCode: vi.fn(async () => ({ stdout: '', stderr: '' })),
  evaluateCodeSubmission: vi.fn(async () => ({ hiddenPassed: 1, hiddenTotal: 1, untrustworthy: false })),
}));
vi.mock('@/services/codeExecution/types', () => ({ validateRunInput: () => [] }));

import { submitAttemptHandler } from '@/controllers/candidateAssessmentController';
import { createInvitesHandler } from '@/controllers/assessmentController';
import { setApplicationStage } from '@/services/hiring/applicationService';
import { getApplicationRecord } from '@/services/hiring/applicationService';
import { isValidTransition } from '@/services/hiring/stageTypes';
import { loadWorkspace } from '@/services/hiring/assessmentWorkspace';

const REC = 'rec-1';
const JOB = 'job-1';
const CAND = 'cand-1';
const ASSESSMENT = 'asmt-1';

/**
 * Minimal Express request/response double.
 *
 * `next` RETHROWS rather than swallowing. `asyncHandler` forwards every thrown
 * error to it, so a silent `() => undefined` turns a thrown AppError into a
 * test that merely sees a null response body — and asserts nothing.
 */
interface ResponseState {
  status: number
  json: Record<string, unknown> | null
  settled: boolean
  resolve: null | (() => void)
}

function harness() {
  const state: ResponseState = { status: 200, json: null, settled: false, resolve: null as null | (() => void) }
  const res = {
    status(code: number) {
      state.status = code
      return res
    },
    json(payload: unknown) {
      state.json = payload as Record<string, unknown>
      state.settled = true
      state.resolve?.()
      return res
    },
    setHeader() {
      return res
    },
  }
  return { res: res as never, state }
}

/**
 * Invoke an `asyncHandler`-wrapped controller and WAIT for it to settle.
 *
 * Two traps this avoids:
 *
 *  1. `asyncHandler` returns `(req, res, next): void` — it does NOT return the
 *     promise. `await handler(req, res, next)` therefore resolves immediately
 *     and every assertion races a handler that has not started. Such tests pass
 *     vacuously.
 *  2. `next` fires only on a thrown error. On success the controller just calls
 *     `res.json`, so resolving from `next` alone hangs forever.
 *
 * So: resolve when the response is written, reject when `next` reports an error.
 */
function invoke(
  handler: (req: never, res: never, next: (err?: unknown) => void) => void,
  req: unknown,
  h: ReturnType<typeof harness>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    h.state.resolve = resolve
    handler(req as never, h.res as never, (err?: unknown) => (err ? reject(err) : resolve()))
    // A handler that returns without writing a response would hang; fail loudly.
    if (h.state.settled) resolve()
  })
}

function seed() {
  db.seed('recruiters', [{ id: REC, clerk_id: 'user_1' }])
  db.seed('jobs', [
    { id: JOB, recruiter_id: REC, title: 'Backend Engineer', status: 'open', progression_config: {} },
  ])
  db.seed('candidates', [
    { id: CAND, recruiter_id: REC, full_name: 'Ada', email: 'ada@example.com', current_status: 'Screening' },
  ])
  db.seed('job_applications', [
    { id: 'app-1', job_id: JOB, candidate_id: CAND, recruiter_id: REC, current_stage: 'Shortlisted' },
  ])
  db.seed('screening_results', [
    { job_id: JOB, candidate_id: CAND, status: 'passed', overall: 88, recruiter_override: false },
  ])
  db.seed('hiring_progression_events', [])
  db.seed('candidate_status_log', [])
  db.seed('hiring_stages', [])
  db.seed('interviews', [])
  db.seed('interview_invites', [])
  db.seed('email_logs', [])
  db.seed('recruiter_activity', [])

  const snapshot = {
    version: 1,
    assessment_id: ASSESSMENT,
    name: 'Backend Assessment',
    duration_minutes: 30,
    passing_score: 60,
    settings: {},
    published_at: new Date().toISOString(),
    total_marks: 10,
    questions: [
      {
        id: 'q1',
        type: 'mcq',
        position: 0,
        title: 'Event loop',
        prompt: 'Which queue does setImmediate use?',
        payload: { options: [{ id: 'o1', text: 'check' }, { id: 'o2', text: 'immediate' }], correct_option_id: 'o2' },
        marks: 10,
        skill_tag: 'Node.js',
        is_required: true,
      },
    ],
  }
  db.seed('assessments', [
    {
      id: ASSESSMENT, job_id: JOB, recruiter_id: REC, name: 'Backend Assessment',
      status: 'published', duration_minutes: 30, passing_score: 60,
      snapshot_version: 1, published_snapshot: snapshot, available_until: null,
    },
  ])
  db.seed('assessment_snapshots', [
    { assessment_id: ASSESSMENT, version: 1, snapshot, published_at: new Date().toISOString() },
  ])
  db.seed('assessment_questions', [])
  db.seed('assessment_invites', [])
  db.seed('assessment_attempts', [
    {
      id: 'att-1',
      assessment_id: ASSESSMENT,
      candidate_id: CAND,
      invite_id: 'inv-1',
      attempt_number: 1,
      status: 'in_progress',
      started_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      snapshot_version: 1,
      snapshot_source: 'snapshot',
    },
  ])
  db.seed('assessment_answers', [
    { id: 'a1', attempt_id: 'att-1', question_id: 'q1', answer: { selected_option_id: 'o2' }, score: null, max_score: null, is_correct: null },
  ])
  db.seed('proctoring_events', [])
  db.addUniqueConstraint('hiring_progression_events', ['trigger_type', 'trigger_id'])
  db.addUniqueConstraint('assessment_invites', ['assessment_id', 'candidate_id'])
  db.derive('job_pipeline', () =>
    db.rows('job_applications').filter((r) => r.job_id != null).map((r) => ({ ...r, stage: r.current_stage })),
  )
  enqueuedEmails.length = 0
  enqueuedProgressions.length = 0
}

/** Submit as the candidate (the handler reads identity from the session context). */
async function submit() {
  const h = harness()
  const request = {
    params: { attemptId: 'att-1' },
    body: {},
    candidate: { candidateId: CAND, inviteId: 'inv-1', assessmentId: ASSESSMENT, scope: 'assessment', sessionId: 's1' },
  }
  await invoke(submitAttemptHandler as never, request, h)
  return h.state
}

describe('assessment submission', () => {
  beforeEach(() => seed())

  it('persists the score and percentage', async () => {
    const out = await submit()
    expect(out.status).toBe(200)
    expect(out.json).toMatchObject({ success: true })
    expect(out.json?.data).toMatchObject({
      status: 'evaluated', score: 10, maxScore: 10, percentage: 100, passed: true,
    })

    const attempt = db.rows('assessment_attempts')[0]
    expect(attempt.status).toBe('evaluated')
    expect(attempt.percentage).toBe(100)
    expect(typeof attempt.submitted_at).toBe('string')
  })

  it('grades against the pinned snapshot, not the live question set', async () => {
    await submit()
    const attempt = db.rows('assessment_attempts')[0]
    expect(attempt.snapshot_version).toBe(1)
    expect(attempt.snapshot_source).toBe('snapshot')
    // The answer scored 10/10 because the SNAPSHOT says q1's answer is o2.
    expect(attempt.score).toBe(10)
  })

  it('marks the invite completed — the value the schema drift made impossible', async () => {
    db.rows('assessment_invites').push({
      id: 'inv-1', assessment_id: ASSESSMENT, candidate_id: CAND,
      job_application_id: 'app-1', status: 'opened', delivery_status: 'sent',
      sent_at: new Date().toISOString(), send_count: 1, snapshot_version: 1,
    })
    await submit()
    expect(db.rows('assessment_invites')[0].status).toBe('completed')
  })

  it('enqueues progression scoped to THIS job', async () => {
    await submit()
    expect(enqueuedProgressions).toHaveLength(1)
    expect(enqueuedProgressions[0]).toMatchObject({ jobId: JOB, candidateId: CAND, fromStage: 'Assessment' })
  })

  it('a duplicate submit returns the persisted result and creates no second event', async () => {
    await submit()
    const first = db.rows('assessment_attempts')[0]
    enqueuedProgressions.length = 0

    const second = await submit()
    expect(second.json?.data).toMatchObject({ deduplicated: true, percentage: 100 })
    expect(db.rows('assessment_attempts')[0].score).toBe(first.score)
    // No re-enqueue: `hiring_progression_events` is UNIQUE on the trigger.
    expect(enqueuedProgressions).toHaveLength(0)
  })

  it('does not double-count the score on a repeated submit', async () => {
    await submit()
    await submit()
    expect(db.rows('assessment_attempts')[0].score).toBe(10)
  })
});

describe('issuing an invitation moves the application into Assessment', () => {
  beforeEach(() => seed())

  function inviteRequest() {
    return {
      params: { assessmentId: ASSESSMENT },
      body: { candidateIds: [CAND] },
      recruiter: { id: REC },
    } as never
  }

  it('transitions Shortlisted → Assessment for that job application', async () => {
    const h = harness()
    await invoke(createInvitesHandler as never, inviteRequest(), h)

    const application = await getApplicationRecord(JOB, CAND)
    expect(application?.current_stage).toBe('Assessment')
  })

  it('is what makes the later advance to the technical round legal', async () => {
    // Without this transition, progression on submit would reject the move as a
    // skipped stage: `Shortlisted → Technical Round` is rank 2 → 4.
    const h = harness()
    await invoke(createInvitesHandler as never, inviteRequest(), h)

    expect(isValidTransition('Shortlisted', 'Technical Round').valid).toBe(false);
    expect(isValidTransition('Assessment', 'Technical Round').valid).toBe(true)

    await setApplicationStage({
      jobId: JOB, candidateId: CAND, recruiterId: REC,
      toStage: 'Technical Round', triggerType: 'manual', triggerId: 'advance',
    })
    expect((await getApplicationRecord(JOB, CAND))?.current_stage).toBe('Technical Round')
  })

  it('pins the invite to the published version and the application', async () => {
    const h = harness()
    await invoke(createInvitesHandler as never, inviteRequest(), h)

    const invite = db.rows('assessment_invites')[0]
    expect(invite.snapshot_version).toBe(1)
    expect(invite.job_application_id).toBe('app-1')
    expect(invite.delivery_status).toBe('pending')
  })

  it('is idempotent — a second send adds no second stage event', async () => {
    await invoke(createInvitesHandler as never, inviteRequest(), harness())
    const events = db.rows('hiring_progression_events').length
    await invoke(createInvitesHandler as never, inviteRequest(), harness())
    expect(db.rows('hiring_progression_events').length).toBe(events)
    expect((await getApplicationRecord(JOB, CAND))?.current_stage).toBe('Assessment')
  })

  it('shows the candidate as completed in the workspace afterwards', async () => {
    await invoke(createInvitesHandler as never, inviteRequest(), harness())
    await submit()

    const workspace = await loadWorkspace({ recruiterId: REC, jobId: JOB })
    expect(workspace.pipeline[0].stage).toBe('Assessment')
    expect(workspace.pipeline[0].assessment?.state).toBe('completed')
    expect(workspace.pipeline[0].assessment?.percentage).toBe(100)
  })
});