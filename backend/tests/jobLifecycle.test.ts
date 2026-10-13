import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FakeDb, makeClient } from './helpers/fakeSupabase';

/**
 * Job open/closed lifecycle.
 *
 * Closing a job must stop NEW recruitment activity and change nothing else. The
 * central risk is a "close" that quietly hides or destroys history; every test
 * below asserts that candidates, applications, screening results, assessments,
 * attempts, interviews and reports survive.
 */

const db = new FakeDb();

vi.mock('@/services/supabase/client', () => ({
  getSupabaseClient: () => makeClient(db),
}));

const activityCalls: Array<Record<string, unknown>> = [];
vi.mock('@/services/activity', () => ({
  logActivity: vi.fn(async (p: Record<string, unknown>) => {
    activityCalls.push(p);
  }),
  ACTION_TYPE_VALUES: ['job_status_changed'],
}));

import {
  setJobStatus,
  isJobOpen,
  assertJobAccepts,
  allowsInvitesWhenClosed,
  requireOwnedJob,
  JOB_STATUS,
  JobClosedError,
} from '@/services/hiring/jobLifecycleService';
import { enrollCandidate } from '@/services/hiring/jobApplicationService';
import { AppError } from '@/middleware/errorHandler';

const REC = 'rec-1';
const JOB = 'job-1';

function seed(status: 'open' | 'closed' = 'open', config: Record<string, unknown> = {}) {
  db.seed('jobs', [
    { id: JOB, recruiter_id: REC, title: 'Backend Engineer', status, progression_config: config },
  ]);
  db.seed('candidates', [
    { id: 'cand-1', recruiter_id: REC, full_name: 'Ada', email: 'ada@example.com' },
  ]);
  db.seed('job_applications', [
    { id: 'app-1', job_id: JOB, candidate_id: 'cand-1', recruiter_id: REC, current_stage: 'Assessment' },
  ]);
  db.seed('screening_results', [
    { job_id: JOB, candidate_id: 'cand-1', status: 'passed', overall: 88 },
  ]);
  db.seed('assessments', [
    { id: 'asmt-1', job_id: JOB, recruiter_id: REC, name: 'Backend Assessment', status: 'published' },
  ]);
  db.seed('assessment_attempts', [
    { id: 'att-1', assessment_id: 'asmt-1', candidate_id: 'cand-1', status: 'evaluated', score: 18, max_score: 20 },
  ]);
  db.seed('interviews', [
    { id: 'int-1', job_id: JOB, candidate_id: 'cand-1', status: 'completed' },
  ]);
  db.seed('candidate_reports', [
    { id: 'rep-1', job_id: JOB, candidate_id: 'cand-1', report_type: 'internal', version: 1 },
  ]);
  db.seed('email_logs', []);
  db.seed('recruiter_activity', []);
  db.addUniqueConstraint('job_applications', ['job_id', 'candidate_id']);
  activityCalls.length = 0;
}

function job() {
  return db.rows('jobs')[0] as Record<string, unknown>;
}

describe('setJobStatus', () => {
  beforeEach(() => seed());

  it('closes an open job', async () => {
    const result = await setJobStatus({ recruiterId: REC, jobId: JOB, status: JOB_STATUS.CLOSED });
    expect(result.changed).toBe(true);
    expect(job().status).toBe('closed');
    expect(job().closed_by).toBe(REC);
    expect(typeof job().closed_at).toBe('string');
  });

  it('reopens a closed job and clears the closure actor', async () => {
    db.rows('jobs')[0].status = 'closed';
    db.rows('jobs')[0].closed_by = REC;
    const result = await setJobStatus({ recruiterId: REC, jobId: JOB, status: JOB_STATUS.OPEN });
    expect(result.status).toBe('open');
    expect(job().closed_by).toBeNull();
    expect(job().closed_at).toBeNull();
    expect(typeof job().reopened_at).toBe('string');
  });

  it('is idempotent', async () => {
    await setJobStatus({ recruiterId: REC, jobId: JOB, status: JOB_STATUS.CLOSED });
    const again = await setJobStatus({ recruiterId: REC, jobId: JOB, status: JOB_STATUS.CLOSED });
    expect(again.changed).toBe(false);
  });

  it('DELETES NOTHING — every historical record survives a close', async () => {
    await setJobStatus({ recruiterId: REC, jobId: JOB, status: JOB_STATUS.CLOSED });
    expect(db.rows('candidates')).toHaveLength(1);
    expect(db.rows('job_applications')).toHaveLength(1);
    expect(db.rows('screening_results')).toHaveLength(1);
    expect(db.rows('assessments')).toHaveLength(1);
    expect(db.rows('assessment_attempts')).toHaveLength(1);
    expect(db.rows('interviews')).toHaveLength(1);
    expect(db.rows('candidate_reports')).toHaveLength(1);
    // The attempt result is untouched.
    expect(db.rows('assessment_attempts')[0].score).toBe(18);
  });

  it('records what closing preserves, so an auditor can see the intent', async () => {
    await setJobStatus({ recruiterId: REC, jobId: JOB, status: JOB_STATUS.CLOSED, reason: 'Role filled' });
    const entry = activityCalls.find((a) => a.actionType === 'job_status_changed');
    expect(entry?.description).toMatch(/closed/i);
    expect((entry?.metadata as Record<string, unknown>).preserves).toContain('assessment_attempts');
    expect((entry?.metadata as Record<string, unknown>).reason).toBe('Role filled');
  });

  it('404s a job owned by another recruiter', async () => {
    db.rows('jobs').push({ id: 'job-9', recruiter_id: 'rec-2', title: 'Theirs', status: 'open' });
    try {
      await setJobStatus({ recruiterId: REC, jobId: 'job-9', status: JOB_STATUS.CLOSED });
      throw new Error('expected rejection');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(404);
    }
  });
});

describe('gates', () => {
  it('refuses enrolment on a closed job', async () => {
    seed('closed');
    expect(await isJobOpen(REC, JOB)).toBe(false);
    await expect(
      enrollCandidate({ jobId: JOB, candidateId: 'cand-1', recruiterId: REC }),
    ).rejects.toBeInstanceOf(JobClosedError);
  });

  it('allows enrolment on an open job', async () => {
    seed('open');
    await expect(
      enrollCandidate({ jobId: JOB, candidateId: 'cand-1', recruiterId: REC }),
    ).resolves.toBeTruthy();
  });

  it('refuses screening, invites and progression on a closed job', async () => {
    seed('closed');
    for (const activity of ['screen', 'invite', 'advance', 'schedule_interview'] as const) {
      await expect(assertJobAccepts(REC, JOB, activity)).rejects.toBeInstanceOf(JobClosedError);
    }
  });

  it('returns a JOB_CLOSED code with an override hint', async () => {
    seed('closed');
    try {
      await assertJobAccepts(REC, JOB, 'invite');
      throw new Error('expected rejection');
    } catch (err) {
      const e = err as JobClosedError;
      expect(e).toBeInstanceOf(JobClosedError);
      expect(e.code).toBe('JOB_CLOSED');
      expect(e.details.overrideAllowed).toBe(false);
      expect(e.message).toMatch(/reopen the job/i);
    }
  });

  it('keeps a closed job fully readable', async () => {
    seed('closed');
    const owned = await requireOwnedJob(REC, JOB);
    expect(owned.id).toBe(JOB);
    expect(owned.title).toBe('Backend Engineer');
    expect(owned.status).toBe('closed');
  });
});

describe('the authorized closed-job invite override', () => {
  it('is refused by default', async () => {
    seed('closed', {});
    await expect(
      assertJobAccepts(REC, JOB, 'invite', { respectInviteOverride: true }),
    ).rejects.toBeInstanceOf(JobClosedError);
  });

  it('allows invitations when explicitly enabled', async () => {
    seed('closed', { allow_invites_when_closed: true });
    await expect(
      assertJobAccepts(REC, JOB, 'invite', { respectInviteOverride: true }),
    ).resolves.toMatchObject({ id: JOB });
  });

  it('is fail-closed on a non-true value', async () => {
    for (const value of ['true', 1, 'yes', null]) {
      seed('closed', { allow_invites_when_closed: value });
      expect(await allowsInvitesWhenClosed({ progression_config: { allow_invites_when_closed: value } })).toBe(false);
      await expect(
        assertJobAccepts(REC, JOB, 'invite', { respectInviteOverride: true }),
      ).rejects.toBeInstanceOf(JobClosedError);
    }
  });

  it('is fail-closed when progression_config is missing entirely', async () => {
    seed('closed', {});
    db.rows('jobs')[0].progression_config = null;
    expect(await allowsInvitesWhenClosed({ progression_config: null })).toBe(false);
  });

  it('does not unlock the other gates', async () => {
    seed('closed', { allow_invites_when_closed: true });
    // Only invitations are exempt. Enrolment and progression stay refused.
    for (const activity of ['enrol', 'advance', 'screen'] as const) {
      await expect(assertJobAccepts(REC, JOB, activity)).rejects.toBeInstanceOf(JobClosedError);
    }
  });

  it('reports overrideAllowed so the UI can explain the escape hatch', async () => {
    seed('closed', { allow_invites_when_closed: true });
    try {
      await assertJobAccepts(REC, JOB, 'invite');
      throw new Error('expected rejection');
    } catch (err) {
      const e = err as JobClosedError;
      expect(e.details.overrideAllowed).toBe(true);
      expect(e.message).toMatch(/allow assessment invitations on closed jobs/i);
    }
  });
});