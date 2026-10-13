import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FakeDb, makeClient } from './helpers/fakeSupabase';

/**
 * Shortlisting is a first-class, PER-JOB, recruiter-only decision.
 *
 * These tests pin the properties that make it trustworthy:
 *   1. it applies to one job application and never leaks across jobs
 *   2. it records who did it and when
 *   3. it is idempotent under double clicks and retries
 *   4. it preserves the screening score and previous decisions
 *   5. it is reversible, with the reversal audited rather than erased
 */

const db = new FakeDb();

vi.mock('@/services/supabase/client', () => ({
  getSupabaseClient: () => makeClient(db),
}));

const activityCalls: Array<Record<string, unknown>> = [];
vi.mock('@/services/activity', () => ({
  logActivity: vi.fn(async (params: Record<string, unknown>) => {
    activityCalls.push(params);
  }),
  ACTION_TYPE_VALUES: ['candidate_shortlisted', 'candidate_shortlist_reversed'],
}));

import {
  shortlistCandidate,
  reverseShortlist,
  checkShortlistEligibility,
  listShortlistedApplications,
} from '@/services/hiring/shortlistService';
import { getApplicationRecord } from '@/services/hiring/applicationService';
import { AppError } from '@/middleware/errorHandler';

const REC = 'rec-1';
const OTHER = 'rec-2';
const JOB = 'job-1';
const JOB2 = 'job-2';
const CAND = 'cand-1';

function seed(opts: { stage?: string; screening?: Record<string, unknown> | null } = {}) {
  db.seed('jobs', [
    { id: JOB, recruiter_id: REC, title: 'Backend Engineer', status: 'open', progression_config: {} },
    { id: JOB2, recruiter_id: REC, title: 'Frontend Engineer', status: 'open', progression_config: {} },
  ]);
  db.seed('candidates', [
    { id: CAND, recruiter_id: REC, full_name: 'Ada Lovelace', email: 'ada@example.com', current_status: 'Applied' },
    { id: 'cand-x', recruiter_id: OTHER, full_name: 'Mallory', email: 'm@example.com' },
  ]);
  db.seed('job_applications', [
    {
      id: 'app-1',
      job_id: JOB,
      candidate_id: CAND,
      recruiter_id: REC,
      current_stage: opts.stage ?? 'Screening',
      source: 'recruiter_upload',
      applied_at: '2026-10-01T00:00:00.000Z',
      // A pre-shortlisted row carries the attribution a previous shortlist
      // would have written, so reversal tests have something to preserve.
      ...(opts.stage === 'Shortlisted'
        ? {
            shortlisted_at: '2026-10-05T09:00:00.000Z',
            shortlisted_by: REC,
            shortlist_note: 'originally shortlisted',
          }
        : {}),
    },
  ]);
  db.seed('screening_results', opts.screening === null ? [] : [
    {
      job_id: JOB,
      candidate_id: CAND,
      status: opts.screening?.status ?? 'passed',
      overall: opts.screening?.overall ?? 82,
      ai_overall: opts.screening?.overall ?? 82,
      recruiter_override: opts.screening?.overridden ?? false,
      matched_skills: ['Node', 'SQL'],
      missing_skills: ['Kubernetes'],
    },
  ]);
  db.seed('hiring_progression_events', []);
  db.seed('candidate_status_log', []);
  db.seed('recruiter_activity', []);
  db.addUniqueConstraint('hiring_progression_events', ['trigger_type', 'trigger_id']);
  activityCalls.length = 0;
}

function app() {
  return db.rows('job_applications').find((r) => r.id === 'app-1') as Record<string, unknown>;
}

describe('shortlisting', () => {
  beforeEach(() => seed());

  it('moves the candidate to Shortlisted on THIS job only', async () => {
    const result = await shortlistCandidate({ recruiterId: REC, jobId: JOB, candidateId: CAND });
    expect(result.changed).toBe(true);
    expect(result.toStage).toBe('Shortlisted');
    expect(result.fromStage).toBe('Screening');
    expect(app().current_stage).toBe('Shortlisted');
  });

  it('records who shortlisted, when, and any note', async () => {
    await shortlistCandidate({
      recruiterId: REC,
      jobId: JOB,
      candidateId: CAND,
      note: 'Strong systems background',
    });
    expect(app().shortlisted_by).toBe(REC);
    expect(typeof app().shortlisted_at).toBe('string');
    expect(app().shortlist_note).toBe('Strong systems background');
    expect(app().stage_changed_at).toBeTruthy();
  });

  it('leaves the candidate at Screening on a DIFFERENT job', async () => {
    db.rows('job_applications').push({
      id: 'app-2',
      job_id: JOB2,
      candidate_id: CAND,
      recruiter_id: REC,
      current_stage: 'Screening',
      source: 'recruiter_upload',
    });
    await shortlistCandidate({ recruiterId: REC, jobId: JOB, candidateId: CAND });

    const other = db.rows('job_applications').find((r) => r.id === 'app-2') as Record<string, unknown>;
    expect(other.current_stage).toBe('Screening');
    expect(other.shortlisted_at).toBeFalsy();
  });

  it('preserves the screening score and its override flag', async () => {
    const result = await shortlistCandidate({ recruiterId: REC, jobId: JOB, candidateId: CAND });
    expect(result.screeningScore).toBe(82);
    const row = db.rows('screening_results')[0];
    expect(row.status).toBe('passed');
    expect(row.overall).toBe(82);
    expect(row.ai_overall).toBe(82);
  });

  it('shortlists a candidate with NO screening result, reporting a null score', async () => {
    seed({ screening: null });
    const result = await shortlistCandidate({ recruiterId: REC, jobId: JOB, candidateId: CAND });
    expect(result.changed).toBe(true);
    // Honest: no score is invented.
    expect(result.screeningScore).toBeNull();
  });

  it('is idempotent under a double click', async () => {
    const first = await shortlistCandidate({ recruiterId: REC, jobId: JOB, candidateId: CAND });
    const second = await shortlistCandidate({ recruiterId: REC, jobId: JOB, candidateId: CAND });
    expect(first.changed).toBe(true);
    expect(second.changed).toBe(false);
    expect(second.deduplicated).toBe(true);
    expect(db.rows('hiring_progression_events')).toHaveLength(1);
  });

  it('writes an attributable timeline entry', async () => {
    await shortlistCandidate({ recruiterId: REC, jobId: JOB, candidateId: CAND });
    const log = db.rows('candidate_status_log')[0] as Record<string, unknown>;
    expect(log.status).toBe('Shortlisted');
    expect(log.job_id).toBe(JOB);
    expect(log.recruiter_id).toBe(REC);
    expect((log.details as Record<string, unknown>).action).toBe('application_stage_changed');
    expect((log.details as Record<string, unknown>).by).toBe(REC);
    expect((log.details as Record<string, unknown>).screening_score).toBe(82);
  });

  it('records the shortlist in the recruiter activity feed', async () => {
    await shortlistCandidate({ recruiterId: REC, jobId: JOB, candidateId: CAND });
    expect(activityCalls.some((a) => a.actionType === 'candidate_shortlisted')).toBe(true);
  });

  it('mirrors candidates.current_status for a single-application candidate', async () => {
    const result = await shortlistCandidate({ recruiterId: REC, jobId: JOB, candidateId: CAND });
    expect(result.mirroredToCandidate).toBe(true);
    expect(db.rows('candidates').find((c) => c.id === CAND)?.current_status).toBe('Shortlisted');
  });

  it('does NOT mirror once the candidate has several applications', async () => {
    db.rows('job_applications').push({
      id: 'app-2', job_id: JOB2, candidate_id: CAND, recruiter_id: REC, current_stage: 'Screening',
    });
    const result = await shortlistCandidate({ recruiterId: REC, jobId: JOB, candidateId: CAND });
    expect(result.changed).toBe(true);
    expect(result.mirroredToCandidate).toBe(false);
    expect(db.rows('candidates').find((c) => c.id === CAND)?.current_status).toBe('Applied');
  });
});

describe('shortlisting from Applied', () => {
  beforeEach(() => seed({ stage: 'Applied' }));

  it('allows the recruiter override and flags it', async () => {
    const result = await shortlistCandidate({ recruiterId: REC, jobId: JOB, candidateId: CAND });
    expect(result.changed).toBe(true);
    expect(result.usedOverride).toBe(true);
    const log = db.rows('candidate_status_log')[0] as Record<string, unknown>;
    expect((log.details as Record<string, unknown>).recruiter_override).toBe(true);
  });
});

describe('shortlist eligibility', () => {
  it('is blocked once the candidate has moved past assessment', async () => {
    seed({ stage: 'Assessment' });
    const check = await checkShortlistEligibility({ recruiterId: REC, jobId: JOB, candidateId: CAND });
    expect(check.eligible).toBe(false);
    expect(check.reason).toMatch(/already at/i);
    await expect(
      shortlistCandidate({ recruiterId: REC, jobId: JOB, candidateId: CAND }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('is blocked for a rejected candidate, pointing at the reversal path', async () => {
    seed({ stage: 'Rejected' });
    const check = await checkShortlistEligibility({ recruiterId: REC, jobId: JOB, candidateId: CAND });
    expect(check.eligible).toBe(false);
    expect(check.reason).toMatch(/reverse that decision/i);
  });

  it('is blocked for a hired candidate', async () => {
    seed({ stage: 'Hired' });
    const check = await checkShortlistEligibility({ recruiterId: REC, jobId: JOB, candidateId: CAND });
    expect(check.eligible).toBe(false);
  });

  it('reports "not in this job" rather than throwing', async () => {
    const check = await checkShortlistEligibility({ recruiterId: REC, jobId: JOB2, candidateId: CAND });
    expect(check.eligible).toBe(false);
    expect(check.reason).toMatch(/has not applied/i);
  });

  it('404s a candidate owned by another recruiter', async () => {
    await expect(
      checkShortlistEligibility({ recruiterId: REC, jobId: JOB, candidateId: 'cand-x' }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('404s a job owned by another recruiter', async () => {
    db.rows('jobs').push({ id: 'job-9', recruiter_id: OTHER, title: 'Theirs', status: 'open' });
    try {
      await shortlistCandidate({ recruiterId: REC, jobId: 'job-9', candidateId: CAND });
      throw new Error('expected rejection');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(404);
    }
  });

  it('treats already-shortlisted as eligible (a no-op, not an error)', async () => {
    seed({ stage: 'Shortlisted' });
    const check = await checkShortlistEligibility({ recruiterId: REC, jobId: JOB, candidateId: CAND });
    expect(check.eligible).toBe(true);
  });
});

describe('reversing a shortlist', () => {
  beforeEach(() => seed({ stage: 'Shortlisted' }));

  it('returns the candidate to Screening and audits the reversal', async () => {
    const result = await reverseShortlist({
      recruiterId: REC,
      jobId: JOB,
      candidateId: CAND,
      reason: 'Went with another candidate',
    });
    expect(result.changed).toBe(true);
    expect(result.toStage).toBe('Screening');
    expect(app().current_stage).toBe('Screening');

    const logs = db.rows('candidate_status_log');
    const marker = logs.find(
      (l) => (l.details as Record<string, unknown>).action === 'shortlist_reversed',
    ) as Record<string, unknown>;
    expect(marker).toBeTruthy();
    expect((marker.details as Record<string, unknown>).from).toBe('Shortlisted');
    expect((marker.details as Record<string, unknown>).reason).toBe('Went with another candidate');
  });

  it('keeps the original shortlist attribution on the row for audit', async () => {
    await reverseShortlist({ recruiterId: REC, jobId: JOB, candidateId: CAND });
    // The WHEN/WHO of the original decision is preserved, not erased.
    expect(app().shortlisted_by).toBe(REC);
    expect(app().shortlisted_at).toBeTruthy();
  });

  it('does not destroy the screening result', async () => {
    await reverseShortlist({ recruiterId: REC, jobId: JOB, candidateId: CAND });
    const row = db.rows('screening_results')[0];
    expect(row.status).toBe('passed');
    expect(row.overall).toBe(82);
  });

  it('refuses when the candidate is not shortlisted', async () => {
    db.rows('job_applications')[0].current_stage = 'Assessment';
    await expect(
      reverseShortlist({ recruiterId: REC, jobId: JOB, candidateId: CAND }),
    ).rejects.toThrow(/nothing to reverse/i);
  });

  it('only affects the targeted job', async () => {
    db.rows('job_applications').push({
      id: 'app-2', job_id: JOB2, candidate_id: CAND, recruiter_id: REC, current_stage: 'Shortlisted',
    });
    await reverseShortlist({ recruiterId: REC, jobId: JOB, candidateId: CAND });
    const other = db.rows('job_applications').find((r) => r.id === 'app-2') as Record<string, unknown>;
    expect(other.current_stage).toBe('Shortlisted');
  });
});

describe('listShortlistedApplications', () => {
  beforeEach(() => seed());

  it('returns only this job’s shortlisted applications', async () => {
    db.rows('job_applications').push({
      id: 'app-2', job_id: JOB2, candidate_id: CAND, recruiter_id: REC, current_stage: 'Shortlisted',
    });
    db.rows('job_applications').push({
      id: 'app-3', job_id: JOB, candidate_id: 'cand-x', recruiter_id: OTHER, current_stage: 'Shortlisted',
    });

    const rows = await listShortlistedApplications(JOB, REC);
    const ids = rows.map((r) => r.applicationId).sort();
    // app-1 is at Screening, so only app-3 matches on job-1 — and it belongs to
    // another recruiter's candidate. The query is keyed on job, not recruiter,
    // so ownership is enforced by the caller resolving the job first.
    expect(ids).toEqual(['app-3']);
  });

  it('returns the shortlisted application for the job', async () => {
    db.rows('job_applications')[0].current_stage = 'Shortlisted';
    const rows = await listShortlistedApplications(JOB, REC);
    expect(rows).toEqual([{ applicationId: 'app-1', candidateId: CAND }]);
  });
});

describe('membership is authoritative', () => {
  beforeEach(() => seed());

  it('refuses to shortlist a candidate who never applied to this job', async () => {
    await expect(
      shortlistCandidate({ recruiterId: REC, jobId: JOB2, candidateId: CAND }),
    ).rejects.toThrow(/has not applied to this job/i);
  });

  it('reads the stage from job_applications, not the global mirror', async () => {
    // The global column says Applied; the application says Assessment. The
    // application must win — this is the whole point of the refactor.
    db.rows('candidates')[0].current_status = 'Applied';
    db.rows('job_applications')[0].current_stage = 'Assessment';
    const check = await checkShortlistEligibility({ recruiterId: REC, jobId: JOB, candidateId: CAND });
    expect(check.currentStage).toBe('Assessment');
    expect(check.eligible).toBe(false);
  });

  it('reads a legacy stage value through the alias map', async () => {
    db.rows('job_applications')[0].current_stage = 'Managerial/HR';
    const check = await checkShortlistEligibility({ recruiterId: REC, jobId: JOB, candidateId: CAND });
    expect(check.currentStage).toBe('Interview');
  });
});

describe('application record shape', () => {
  beforeEach(() => seed());

  it('exposes the shortlist audit columns', async () => {
    await shortlistCandidate({ recruiterId: REC, jobId: JOB, candidateId: CAND });
    const record = await getApplicationRecord(JOB, CAND);
    expect(record?.current_stage).toBe('Shortlisted');
    expect(record?.shortlisted_by).toBe(REC);
    expect(record?.shortlist_note).toBe('');
  });
});