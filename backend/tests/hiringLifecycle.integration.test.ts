import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FakeDb, makeClient } from './helpers/fakeSupabase';

/**
 * INTEGRATION TEST — drives the REAL progression service and worker through
 * the hiring lifecycle with only the transport (Supabase, Redis/BullMQ,
 * email) faked.
 *
 * This exists because every defect found in the audit was invisible to unit
 * tests: the progression service was correct in isolation while the screening
 * controller bypassed it entirely, the audit table did not exist, and
 * auto-progression failed open toward hiring. Unit tests kept passing
 * throughout.
 */

const db = new FakeDb();

vi.mock('@/services/supabase/client', () => ({
  getSupabaseClient: () => makeClient(db),
}));

// Transport-only fakes. Progression itself must stay real.
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

import {
  advanceCandidate,
  isAutoProgressionEnabled,
  parkPassedCandidate,
  rejectCandidate,
} from '@/services/hiring/progressionService';
import { processProgressionJob } from '@/services/queue/progressionWorker';
import type { ProgressionJobData } from '@/services/queue/progressionQueue';

const REC = 'rec-1';
const JOB = 'job-1';
const CAND = 'cand-1';

function seed(opts: { config?: Record<string, unknown>; status?: string; stage?: string } = {}) {
  db.seed('recruiters', [{ id: REC, clerk_id: 'user_1' }]);
  db.seed('jobs', [
    {
      id: JOB,
      recruiter_id: REC,
      title: 'Backend Engineer',
      progression_config: opts.config ?? {},
    },
  ]);
  db.seed('candidates', [
    { id: CAND, recruiter_id: REC, current_status: opts.status ?? 'Applied', full_name: 'Ada' },
  ]);
  // Membership is authoritative: `job_applications` is now the source of truth
  // for a candidate's stage in a job, and `candidates.current_status` is only a
  // mirror. A candidate with no application row cannot be advanced at all.
  db.seed('job_applications', [
    {
      id: 'app-1',
      job_id: JOB,
      candidate_id: CAND,
      recruiter_id: REC,
      current_stage: opts.stage ?? opts.status ?? 'Applied',
      source: 'recruiter_upload',
      applied_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-01T00:00:00.000Z',
    },
  ]);
  db.seed('hiring_progression_events', []);
  db.seed('candidate_status_log', []);
  db.seed('hiring_stages', []);
  db.seed('interviews', []);
  db.seed('interview_invites', []);
  db.seed('email_logs', []);
  // Simulated UNIQUE constraint. The progression service catches 23505 and
  // re-reads the winning row; without this the retried-trigger assertion below
  // would be testing a path that never executes.
  db.addUniqueConstraint('hiring_progression_events', ['trigger_type', 'trigger_id']);
  enqueuedEmails.length = 0;
  enqueuedProgressions.length = 0;
}

function runJob(data: Partial<ProgressionJobData>) {
  return processProgressionJob({
    data: {
      candidateId: CAND,
      jobId: JOB,
      recruiterId: REC,
      fromStage: 'Applied',
      triggerType: 'screening',
      triggerId: 'screening:job-1:cand-1:passed',
      ...data,
    },
  } as never);
}

const status = () => db.rows('candidates').find((c) => c.id === CAND)?.current_status;
const timeline = () => db.rows('candidate_status_log').map((t) => String(t.status));
const events = () => db.rows('hiring_progression_events');

describe('hiring lifecycle — screening to assessment', () => {
  beforeEach(() => seed());

  it('advances a candidate who PASSES screening from Applied to Screening', async () => {
    seed({ config: { screening_to_assessment: true } });
    await runJob({ passed: true });

    // Regression guard: `nextStageAfter('Applied')` used to return null, which
    // the worker reads as a TERMINAL outcome — a passing candidate would have
    // been sent to rejectCandidate.
    expect(status()).toBe('Screening');
    expect(timeline()).toContain('Screening');
    expect(timeline()).not.toContain('Rejected');
  });

  it('records the transition as an idempotent, recruiter-attributed event', async () => {
    seed({ config: { screening_to_assessment: true } });
    await runJob({ passed: true });

    expect(events()).toHaveLength(1);
    const ev = events()[0];
    expect(ev.trigger_type).toBe('screening');
    expect(ev.status).toBe('completed');
    expect(ev.from_stage).toBe('Applied');
    expect(ev.to_stage).toBe('Screening');
    expect(ev.job_id).toBe(JOB);

    // The timeline row must be attributable to the job and recruiter.
    const log = db.rows('candidate_status_log')[0];
    expect(log.job_id).toBe(JOB);
    expect(log.recruiter_id).toBe(REC);
  });

  it('deduplicates a retried trigger instead of double-advancing', async () => {
    seed({ config: { screening_to_assessment: true } });
    await runJob({ passed: true });
    const timelineAfterFirst = db.rows('candidate_status_log').length;

    await runJob({ passed: true });
    expect(db.rows('candidate_status_log').length).toBe(timelineAfterFirst);
    expect(events()).toHaveLength(1);
  });

  it('parks the candidate for recruiter review when automation is OFF', async () => {
    seed({ config: { screening_to_assessment: false } });
    await runJob({ passed: true });

    // Passed, recorded, but NOT moved without an explicit recruiter opt-in.
    expect(status()).toBe('Applied');
    expect(events()[0].status).toBe('completed');
    const log = db.rows('candidate_status_log')[0];
    expect((log.details as Record<string, unknown>).action).toBe('stage_passed_awaiting_recruiter');
  });

  it('parks when the job has no progression config at all (fails CLOSED)', async () => {
    seed({ config: undefined });
    expect(await isAutoProgressionEnabled(JOB, 'Applied')).toBe(false);
    await runJob({ passed: true });
    expect(status()).toBe('Applied');
  });

  it('never sends an invitation email as a side effect of progression', async () => {
    seed({ config: { screening_to_assessment: true } });
    await runJob({ passed: true });
    expect(enqueuedEmails).toHaveLength(0);
  });
});

describe('hiring lifecycle — automated failure', () => {
  beforeEach(() => seed());

  it('does NOT permanently reject a candidate on an automated fail', async () => {
    seed({ config: { screening_to_assessment: false }, status: 'Assessment' });
    await runJob({ fromStage: 'Assessment', passed: false, triggerType: 'assessment_submission', triggerId: 'attempt-1' });

    // Regression guard: the terminal branch previously ran BEFORE the
    // automation gate, so an AI scoring failure silently and permanently
    // rejected a real candidate with no recruiter involvement.
    expect(status()).not.toBe('Rejected');
    expect(status()).toBe('Assessment');
  });
});

describe('hiring lifecycle — ownership', () => {
  beforeEach(() => seed());

  it('refuses to progress a candidate owned by another recruiter', async () => {
    seed({ config: { screening_to_assessment: true } });
    await runJob({ recruiterId: 'rec-2', passed: true });

    expect(status()).toBe('Applied');
    expect(db.rows('candidate_status_log')).toHaveLength(0);
    // Ownership is verified BEFORE the transition is recorded, so a rejected
    // cross-recruiter trigger never creates an event at all — it cannot be
    // left pending forever the way the old ordering allowed.
    expect(events()).toHaveLength(0);
  });

  it('refuses before it can reject another recruiter\'s candidate', async () => {
    seed({ config: {} });
    await runJob({
      recruiterId: 'rec-2',
      fromStage: 'Assessment',
      passed: false,
      triggerType: 'assessment_submission',
      triggerId: 'attempt-x',
    });
    expect(status()).toBe('Applied');
  });
});

describe('hiring lifecycle — hiring is never automatic', () => {
  beforeEach(() => seed());

  it('blocks an automated hire even if a caller asks for it', async () => {
    seed({ config: { hr_to_offer: true } });
    await expect(
      advanceCandidate({
        candidateId: CAND,
        jobId: JOB,
        recruiterId: REC,
        fromStage: 'Offer',
        toStage: 'Hired',
        triggerType: 'hr_evaluation',
        triggerId: 'eval-1',
      }),
    ).rejects.toThrow(/not permitted|recruiter/i);
    expect(status()).toBe('Applied');
  });

  it('rejects an invalid stage jump', async () => {
    seed({ config: {} });
    await expect(
      advanceCandidate({
        candidateId: CAND,
        jobId: JOB,
        recruiterId: REC,
        fromStage: 'Applied',
        toStage: 'Technical Round',
        triggerType: 'manual',
        triggerId: 'manual-1',
      }),
    ).rejects.toThrow(/skip/i);
  });

  it('rejects moving a candidate backwards', async () => {
    seed({ config: {}, status: 'Assessment' });
    await expect(
      advanceCandidate({
        candidateId: CAND,
        jobId: JOB,
        recruiterId: REC,
        fromStage: 'Assessment',
        toStage: 'Screening',
        triggerType: 'manual',
        triggerId: 'manual-2',
      }),
    ).rejects.toThrow(/backwards/i);
    expect(status()).toBe('Assessment');
  });

  it('allows an outcome from any stage', async () => {
    seed({ config: {} });
    await rejectCandidate({
      candidateId: CAND,
      jobId: JOB,
      recruiterId: REC,
      fromStage: 'Assessment',
      outcome: 'Rejected',
      triggerType: 'manual',
      triggerId: 'manual-3',
      reason: 'Not enough experience',
    });
    expect(status()).toBe('Rejected');
    expect(timeline()).toContain('Rejected');
  });
});

describe('hiring lifecycle — recruiter override stays auditable', () => {
  beforeEach(() => seed());

  it('records a parked candidate without changing their stage', async () => {
    seed({ config: { screening_to_assessment: false } });
    await parkPassedCandidate({
      candidateId: CAND,
      jobId: JOB,
      recruiterId: REC,
      fromStage: 'Assessment',
      toStage: 'Technical Interview',
      triggerType: 'assessment_submission',
      triggerId: 'attempt-9',
    });
    expect(status()).toBe('Applied');
    const details = db.rows('candidate_status_log')[0].details as Record<string, unknown>;
    expect(details.awaiting).toBe('Technical Interview');
  });
});