import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FakeDb, makeClient } from './helpers/fakeSupabase';

/**
 * `job_applications` is the authoritative candidate↔job link AND the
 * authoritative source of a candidate's stage in a job.
 *
 * These tests pin the three properties the old inferred-membership design could
 * not guarantee:
 *   1. duplicate prevention
 *   2. ownership enforcement on both the job AND the candidate
 *   3. per-job isolation — the same candidate can sit in different stages in
 *      different jobs at the same time, which is exactly what the single global
 *      `candidates.current_status` column could never represent.
 */

const db = new FakeDb();

vi.mock('@/services/supabase/client', () => ({
  getSupabaseClient: () => makeClient(db),
}));

vi.mock('@/services/activity', () => ({
  logActivity: vi.fn(async () => undefined),
  ACTION_TYPE_VALUES: ['candidate_shortlisted', 'status_changed'],
}));

import {
  enrollCandidate,
  getApplication,
  listJobPipeline,
  getJobStageCounts,
} from '@/services/hiring/jobApplicationService';
// Stage moves live in `applicationService`, which adds the idempotency claim,
// the attributable audit row, shortlist attribution and the
// `candidates.current_status` compatibility mirror.
import { setApplicationStage } from '@/services/hiring/applicationService';
import { AppError } from '@/middleware/errorHandler';

const REC = 'rec-1';
const JOB = 'job-1';
const CAND = 'cand-1';

let counter = 0;
/** Fresh trigger id per call unless a test needs a stable one. */
function move(stage: string, triggerId?: string) {
  counter += 1;
  return setApplicationStage({
    jobId: JOB,
    candidateId: CAND,
    recruiterId: REC,
    toStage: stage as never,
    triggerType: 'manual',
    triggerId: triggerId ?? `test:${counter}`,
  });
}

describe('job_applications service', () => {
  beforeEach(() => {
    db.seed('jobs', [
      { id: JOB, recruiter_id: REC, title: 'Backend Engineer', status: 'open' },
    ]);
    db.seed('candidates', [
      { id: CAND, recruiter_id: REC, current_status: 'Applied', full_name: 'Ada' },
      { id: 'cand-2', recruiter_id: 'rec-2', current_status: 'Applied', full_name: 'Bo' },
    ]);
    db.seed('job_applications', []);
    db.seed('hiring_progression_events', []);
    db.seed('candidate_status_log', []);
    // `job_pipeline` is a Postgres VIEW, not a table. Register it as derived so
    // it projects the backing table live, exactly as the database does.
    db.derive('job_pipeline', () =>
      db
        .rows('job_applications')
        .filter((r) => r.job_id != null)
        .map((r) => ({ ...r, stage: r.current_stage })),
    );
    // Simulated UNIQUE constraints. Without these the idempotency paths the
    // service depends on (23505 -> re-read winner) never execute in tests.
    db.addUniqueConstraint('hiring_progression_events', ['trigger_type', 'trigger_id']);
    db.addUniqueConstraint('job_applications', ['job_id', 'candidate_id']);
    counter = 0;
  });

  it('enrols a candidate into a job', async () => {
    const app = await enrollCandidate({ jobId: JOB, candidateId: CAND, recruiterId: REC });
    expect(app.candidate_id).toBe(CAND);
    expect(app.job_id).toBe(JOB);
    expect(app.current_stage).toBe('Applied');
  });

  it('prevents the same candidate being applied to the same job twice', async () => {
    await enrollCandidate({ jobId: JOB, candidateId: CAND, recruiterId: REC });
    await enrollCandidate({ jobId: JOB, candidateId: CAND, recruiterId: REC });
    expect(db.rows('job_applications').filter((r) => r.candidate_id === CAND)).toHaveLength(1);
  });

  it('refuses to enrol a candidate owned by another recruiter', async () => {
    await expect(
      enrollCandidate({ jobId: JOB, candidateId: 'cand-2', recruiterId: REC }),
    ).rejects.toBeInstanceOf(AppError);
    expect(db.rows('job_applications')).toHaveLength(0);
  });

  it('refuses to enrol into a job owned by another recruiter', async () => {
    db.rows('jobs').push({ id: 'job-9', recruiter_id: 'rec-2', title: 'Other', status: 'open' });
    await expect(
      enrollCandidate({ jobId: 'job-9', candidateId: CAND, recruiterId: REC }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('does not leak existence: an unowned job returns 404, not 403', async () => {
    try {
      await enrollCandidate({ jobId: 'job-missing', candidateId: CAND, recruiterId: REC });
      throw new Error('expected rejection');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(404);
    }
  });

  it('lists a job pipeline with one row per candidate', async () => {
    await enrollCandidate({ jobId: JOB, candidateId: CAND, recruiterId: REC });
    const rows = await listJobPipeline(JOB, REC);
    expect(rows).toHaveLength(1);
    expect(rows[0].candidate_id).toBe(CAND);
  });

  it("filters the VIEW by `stage`, not the table's `current_stage`", async () => {
    // `job_pipeline` aliases current_stage -> stage. Filtering by
    // `current_stage` against the view would be rejected by PostgREST.
    await enrollCandidate({ jobId: JOB, candidateId: CAND, recruiterId: REC });
    const rows = await listJobPipeline(JOB, REC, { stage: 'Applied' });
    expect(rows).toHaveLength(1);
    const none = await listJobPipeline(JOB, REC, { stage: 'Hired' });
    expect(none).toHaveLength(0);
  });

  it('refuses to list a pipeline for a job the recruiter does not own', async () => {
    db.rows('jobs').push({ id: 'job-9', recruiter_id: 'rec-2', title: 'Other', status: 'open' });
    await expect(listJobPipeline('job-9', REC)).rejects.toBeInstanceOf(AppError);
  });

  it('counts each candidate into exactly one stage bucket', async () => {
    await enrollCandidate({ jobId: JOB, candidateId: CAND, recruiterId: REC });
    const counts = await getJobStageCounts(JOB, REC);
    expect(counts).toEqual({ Applied: 1 });
  });

  it('enforces the transition matrix when moving a job-scoped stage', async () => {
    await enrollCandidate({ jobId: JOB, candidateId: CAND, recruiterId: REC });

    const ok = await move('Screening');
    expect(ok.changed).toBe(true);
    expect(ok.toStage).toBe('Screening');

    // `Shortlisted` sits between Screening and Assessment, so jumping to
    // Technical Round skips two ranks.
    await expect(move('Technical Round')).rejects.toThrow(/skip/i);

    await expect(move('Applied')).rejects.toThrow(/backwards/i);
  });

  it('refuses a legacy stage name as a destination', async () => {
    // Writes only accept canonical values; two spellings of one stage would
    // reintroduce exactly the ambiguity this vocabulary removes.
    await enrollCandidate({ jobId: JOB, candidateId: CAND, recruiterId: REC });
    await expect(move('Managerial/HR')).rejects.toThrow(/not a recognised/i);
  });

  it('lets a recruiter walk the pipeline to Final Decision', async () => {
    await enrollCandidate({ jobId: JOB, candidateId: CAND, recruiterId: REC });
    for (const stage of ['Screening', 'Shortlisted', 'Assessment', 'Technical Round', 'Interview']) {
      const r = await move(stage);
      expect(r.changed).toBe(true);
    }
    const final = await move('Final Decision');
    expect(final.changed).toBe(true);
    expect((await getApplication(JOB, CAND))?.current_stage).toBe('Final Decision');
  });

  it('flags Applied → Shortlisted as a recruiter override but not the ordinary path', async () => {
    db.seed('job_applications', [
      { id: 'app-1', job_id: JOB, candidate_id: CAND, recruiter_id: REC, current_stage: 'Applied' },
    ]);
    const viaApplied = await move('Shortlisted');
    expect(viaApplied.changed).toBe(true);
    expect(viaApplied.usedOverride).toBe(true);

    db.seed('job_applications', [
      { id: 'app-2', job_id: 'job-3', candidate_id: CAND, recruiter_id: REC, current_stage: 'Screening' },
    ]);
    db.rows('jobs').push({ id: 'job-3', recruiter_id: REC, title: 'Second role', status: 'open' });
    const viaScreening = await setApplicationStage({
      jobId: 'job-3', candidateId: CAND, recruiterId: REC,
      toStage: 'Shortlisted', triggerType: 'manual', triggerId: 'test:screened',
    });
    expect(viaScreening.changed).toBe(true);
    expect(viaScreening.usedOverride).toBe(false);
  });

  it('treats a repeat move as a no-op rather than an error', async () => {
    await enrollCandidate({ jobId: JOB, candidateId: CAND, recruiterId: REC });
    await move('Screening');
    const again = await move('Screening');
    expect(again.changed).toBe(false);
  });

  it('collapses a retried trigger onto one event via the idempotency key', async () => {
    await enrollCandidate({ jobId: JOB, candidateId: CAND, recruiterId: REC });
    const triggerId = 'test:stable-trigger';

    const first = await setApplicationStage({
      jobId: JOB, candidateId: CAND, recruiterId: REC,
      toStage: 'Screening', triggerType: 'manual', triggerId,
    });
    expect(first.changed).toBe(true);

    // A second click on the SAME trigger with a DIFFERENT target must not move
    // the candidate again — the duplicate event absorbs it.
    const second = await setApplicationStage({
      jobId: JOB, candidateId: CAND, recruiterId: REC,
      toStage: 'Shortlisted', triggerType: 'manual', triggerId,
    });
    expect(second.deduplicated).toBe(true);
    expect(second.changed).toBe(false);
    expect((await getApplication(JOB, CAND))?.current_stage).toBe('Screening');
    expect(db.rows('hiring_progression_events')).toHaveLength(1);
  });

  it('refuses to move a candidate who is not in the job', async () => {
    await expect(move('Screening')).rejects.toBeInstanceOf(AppError);
  });

  it('refuses to move a candidate the recruiter does not own', async () => {
    db.rows('jobs').push({ id: 'job-2', recruiter_id: 'rec-2', title: 'Other', status: 'open' });
    db.seed('job_applications', [
      { id: 'app-9', job_id: 'job-2', candidate_id: 'cand-2', recruiter_id: 'rec-2', current_stage: 'Applied' },
    ]);
    await expect(
      setApplicationStage({
        jobId: 'job-2', candidateId: 'cand-2', recruiterId: REC,
        toStage: 'Screening', triggerType: 'manual', triggerId: 'test:x',
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("stores stages on `current_stage`, the column the live table already has", async () => {
    // Regression guard: the live `job_applications` table predates this
    // codebase and uses `current_stage`, not `stage`. Writing `stage` would
    // have created a second, competing source of truth.
    await enrollCandidate({ jobId: JOB, candidateId: CAND, recruiterId: REC });
    await move('Screening');
    const stored = db.rows('job_applications').find((r) => r.candidate_id === CAND) as Record<string, unknown>;
    expect(stored.current_stage).toBe('Screening');
    expect(stored).not.toHaveProperty('stage');
  });

  it('allows any stage to end in an outcome', async () => {
    await enrollCandidate({ jobId: JOB, candidateId: CAND, recruiterId: REC });
    const rejected = await move('Rejected');
    expect(rejected.changed).toBe(true);
    expect(rejected.toStage).toBe('Rejected');
  });

  it('mirrors candidates.current_status only for a single-application candidate', async () => {
    await enrollCandidate({ jobId: JOB, candidateId: CAND, recruiterId: REC });
    const result = await move('Screening');
    expect(result.mirroredToCandidate).toBe(true);
    expect(db.rows('candidates').find((c) => c.id === CAND)?.current_status).toBe('Screening');
  });

  it('skips the mirror for a candidate with several applications', async () => {
    // With two applications there is no single correct value for a GLOBAL
    // column, so the mirror is skipped rather than set to an arbitrary one of
    // the candidate's real stages.
    db.rows('jobs').push({ id: 'job-3', recruiter_id: REC, title: 'Second role', status: 'open' });
    await enrollCandidate({ jobId: JOB, candidateId: CAND, recruiterId: REC });
    await enrollCandidate({ jobId: 'job-3', candidateId: CAND, recruiterId: REC });

    const result = await move('Screening');
    expect(result.changed).toBe(true);
    expect(result.mirroredToCandidate).toBe(false);
    // The mirror must not have been touched at all.
    expect(db.rows('candidates').find((c) => c.id === CAND)?.current_status).toBe('Applied');
  });

  it('keeps the same candidate in different stages in different jobs', async () => {
    // The core reason `candidates.current_status` was demoted: one global
    // column could only ever hold one of these two values.
    db.rows('jobs').push({ id: 'job-3', recruiter_id: REC, title: 'Second role', status: 'open' });
    await enrollCandidate({ jobId: JOB, candidateId: CAND, recruiterId: REC });
    await enrollCandidate({ jobId: 'job-3', candidateId: CAND, recruiterId: REC });

    await move('Screening');
    await setApplicationStage({
      jobId: 'job-3', candidateId: CAND, recruiterId: REC,
      toStage: 'Shortlisted', triggerType: 'manual', triggerId: 'test:job3',
    });

    expect((await getApplication(JOB, CAND))?.current_stage).toBe('Screening');
    expect((await getApplication('job-3', CAND))?.current_stage).toBe('Shortlisted');
  });
});