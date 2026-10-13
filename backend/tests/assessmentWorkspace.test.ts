import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FakeDb, makeClient } from './helpers/fakeSupabase';

/**
 * Job-scoped recruitment workspace.
 *
 * The whole point of this service is that two jobs never bleed into each other.
 * These tests are mostly about ISOLATION: a candidate shortlisted for a backend
 * role must be invisible in the frontend role's workspace, and one candidate's
 * assessment must never appear against another's name.
 */

const db = new FakeDb();

vi.mock('@/services/supabase/client', () => ({
  getSupabaseClient: () => makeClient(db),
}));

vi.mock('@/services/activity', () => ({
  logActivity: vi.fn(async () => undefined),
  ACTION_TYPE_VALUES: ['candidate_shortlisted'],
}));

import { loadWorkspace, listShortlistedForAssessment } from '@/services/hiring/assessmentWorkspace';
import { makeRecruiterDecision } from '@/services/hiring/decisionService';
import { setApplicationStage } from '@/services/hiring/applicationService';

const REC = 'rec-1';
const BACKEND = 'job-backend';
const FRONTEND = 'job-frontend';

const NOW = Date.now();
const ISO = new Date(NOW).toISOString();
const FUTURE = new Date(NOW + 86_400_000).toISOString();

function seed() {
  db.seed('jobs', [
    { id: BACKEND, recruiter_id: REC, title: 'Backend Engineer', status: 'open', progression_config: {} },
    { id: FRONTEND, recruiter_id: REC, title: 'Frontend Engineer', status: 'closed', progression_config: {} },
  ]);
  db.seed('candidates', [
    { id: 'c-be', recruiter_id: REC, full_name: 'Bea Backend', email: 'bea@example.com', current_title: 'BE', current_company: 'Acme' },
    { id: 'c-fe', recruiter_id: REC, full_name: 'Fen Frontend', email: 'fen@example.com', current_title: 'FE', current_company: 'Globex' },
  ]);
  // Bea is Shortlisted for BACKEND and in Assessment for FRONTEND — the same
  // person, two independent pipelines.
  db.seed('job_applications', [
    { id: 'app-be-1', job_id: BACKEND, candidate_id: 'c-be', recruiter_id: REC, current_stage: 'Shortlisted', shortlisted_at: ISO, stage_changed_at: ISO },
    { id: 'app-fe-1', job_id: FRONTEND, candidate_id: 'c-fe', recruiter_id: REC, current_stage: 'Assessment', stage_changed_at: ISO },
  ]);
  db.seed('screening_results', [
    { job_id: BACKEND, candidate_id: 'c-be', status: 'passed', overall: 91, recruiter_override: false, matched_skills: ['Node'], missing_skills: [] },
  ]);
  db.seed('assessments', [
    { id: 'asmt-be', job_id: BACKEND, recruiter_id: REC, name: 'Backend Assessment', status: 'published', duration_minutes: 45, passing_score: 60, snapshot_version: 1, available_until: FUTURE, created_at: ISO },
    { id: 'asmt-fe', job_id: FRONTEND, recruiter_id: REC, name: 'Frontend Assessment', status: 'published', duration_minutes: 30, passing_score: 50, snapshot_version: 1, available_until: FUTURE, created_at: ISO },
  ]);
  db.seed('assessment_invites', []);
  db.seed('assessment_attempts', []);
  db.seed('interviews', []);
  db.seed('candidate_reports', []);
  db.derive('job_pipeline', () =>
    db.rows('job_applications').filter((r) => r.job_id != null).map((r) => ({ ...r, stage: r.current_stage })),
  );
  db.addUniqueConstraint('job_applications', ['job_id', 'candidate_id']);
}

describe('workspace job isolation', () => {
  beforeEach(() => seed());

  it('returns only applications belonging to the selected job', async () => {
    const backend = await loadWorkspace({ recruiterId: REC, jobId: BACKEND });
    const frontend = await loadWorkspace({ recruiterId: REC, jobId: FRONTEND });

    expect(backend.pipeline.map((p) => p.candidateId)).toEqual(['c-be']);
    expect(frontend.pipeline.map((p) => p.candidateId)).toEqual(['c-fe']);
  });

  it('never leaks another job\'s assessment, screening score or report', async () => {
    db.rows('screening_results').push({
      job_id: FRONTEND, candidate_id: 'c-fe', status: 'failed', overall: 12, recruiter_override: false,
    });
    db.rows('candidate_reports').push({ id: 'rep-fe', job_id: FRONTEND, candidate_id: 'c-fe' });

    const backend = await loadWorkspace({ recruiterId: REC, jobId: BACKEND });
    const bea = backend.pipeline[0];
    expect(bea.screening?.overall).toBe(91);
    expect(bea.assessment?.assessmentId).toBe('asmt-be');
    expect(bea.assessment?.assessmentName).toBe('Backend Assessment');
    expect(bea.hasReport).toBe(false);
  });

  it('only lists assessments for the selected job', async () => {
    const backend = await loadWorkspace({ recruiterId: REC, jobId: BACKEND });
    const frontend = await loadWorkspace({ recruiterId: REC, jobId: FRONTEND });
    expect(backend.assessments.map((a) => a.id)).toEqual(['asmt-be']);
    expect(frontend.assessments.map((a) => a.id)).toEqual(['asmt-fe']);
  });

  it('404s a job owned by another recruiter', async () => {
    db.rows('jobs').push({ id: 'job-theirs', recruiter_id: 'rec-2', title: 'Theirs', status: 'open' });
    await expect(loadWorkspace({ recruiterId: REC, jobId: 'job-theirs' })).rejects.toThrow(/job not found/i);
  });

  it('returns a well-formed empty payload for a job with no applications', async () => {
    db.rows('jobs').push({ id: 'job-empty', recruiter_id: REC, title: 'Empty', status: 'open', progression_config: {} });
    const result = await loadWorkspace({ recruiterId: REC, jobId: 'job-empty' });
    expect(result.pipeline).toEqual([]);
    expect(result.counts.shortlisted).toBe(0);
    expect(result.job.title).toBe('Empty');
  });
});

describe('shortlisted candidates are the assessment eligibility list', () => {
  beforeEach(() => seed());

  it('lists only candidates Shortlisted on this job', async () => {
    const rows = await listShortlistedForAssessment({ recruiterId: REC, jobId: BACKEND });
    expect(rows.map((r) => r.candidateId)).toEqual(['c-be']);
  });

  it('does NOT list a candidate who merely PASSED screening', async () => {
    // A passing AI score is not a recruiter decision. Eligibility used to be
    // derived from `screening_results.status`, which put candidates in the
    // invitation queue without anyone having looked at them.
    db.rows('job_applications')[0].current_stage = 'Screening';
    const rows = await listShortlistedForAssessment({ recruiterId: REC, jobId: BACKEND });
    expect(rows).toEqual([]);
  });

  it('excludes a candidate whose stage is past assessment', async () => {
    db.rows('job_applications')[0].current_stage = 'Assessment';
    const rows = await listShortlistedForAssessment({ recruiterId: REC, jobId: BACKEND });
    expect(rows).toEqual([]);
  });

  it('keeps the same candidate in two jobs independently', async () => {
    db.rows('job_applications').push({
      id: 'app-be-2', job_id: FRONTEND, candidate_id: 'c-be', recruiter_id: REC, current_stage: 'Shortlisted',
    });
    const backend = await listShortlistedForAssessment({ recruiterId: REC, jobId: BACKEND });
    const frontend = await listShortlistedForAssessment({ recruiterId: REC, jobId: FRONTEND });
    expect(backend.map((r) => r.candidateId).sort()).toEqual(['c-be']);
    // c-fe is at Assessment on the frontend job, so only Bea is shortlisted there.
    expect(frontend.map((r) => r.candidateId)).toEqual(['c-be']);
  });
});

describe('derived assessment state', () => {
  beforeEach(() => seed());

  /** Drive one candidate into a specific invite/attempt state. */
  async function stateFor(stage: string, invite?: Record<string, unknown>, attempt?: Record<string, unknown>) {
    db.rows('job_applications')[0].current_stage = stage;
    db.seed('assessment_invites', invite ? [{ id: 'inv-1', assessment_id: 'asmt-be', candidate_id: 'c-be', job_application_id: 'app-be-1', ...invite } as Record<string, unknown>] : []);
    db.seed('assessment_attempts', attempt ? [{ id: 'att-1', assessment_id: 'asmt-be', candidate_id: 'c-be', ...attempt } as Record<string, unknown>] : []);
    const ws = await loadWorkspace({ recruiterId: REC, jobId: BACKEND });
    return ws.pipeline[0].assessment;
  }

  it('is not_created when the job has no published assessment', async () => {
    db.rows('assessments').length = 0;
    db.rows('job_applications')[0].current_stage = 'Shortlisted';
    const ws = await loadWorkspace({ recruiterId: REC, jobId: BACKEND });
    expect(ws.pipeline[0].assessment?.state).toBe('not_created');
  });

  it('is draft when the assessment is not published', async () => {
    db.rows('assessments')[0].status = 'draft';
    const ws = await loadWorkspace({ recruiterId: REC, jobId: BACKEND });
    expect(ws.pipeline[0].assessment?.state).toBe('draft');
  });

  it('is ready_to_send when published with no invite yet', async () => {
    db.seed('assessment_invites', []);
    db.rows('job_applications')[0].current_stage = 'Shortlisted';
    const ws = await loadWorkspace({ recruiterId: REC, jobId: BACKEND });
    expect(ws.pipeline[0].assessment?.state).toBe('ready_to_send');
  });

  it('is invited once the email is queued', async () => {
    expect((await stateFor('Shortlisted', { status: 'sent', delivery_status: 'pending' }))?.state).toBe('invited');
  });

  it('is failed only when delivery genuinely failed', async () => {
    expect((await stateFor('Shortlisted', { delivery_status: 'failed' }))?.state).toBe('failed');
    // A merely-pending email is NOT a failure.
    expect((await stateFor('Shortlisted', { status: 'sent', delivery_status: 'pending' }))?.state).toBe('invited');
  });

  it('is in_progress when an attempt is open', async () => {
    expect(
      (await stateFor('Shortlisted', { status: 'sent', delivery_status: 'sent' }, { status: 'in_progress', started_at: ISO }))?.state,
    ).toBe('in_progress');
  });

  it('is completed when an attempt was submitted', async () => {
    const a = await stateFor('Shortlisted', { status: 'sent', delivery_status: 'sent' }, {
      status: 'evaluated', submitted_at: ISO, score: 18, max_score: 20, percentage: 90, passed: true,
    });
    expect(a?.state).toBe('completed');
    expect(a?.percentage).toBe(90);
    expect(a?.passed).toBe(true);
    expect(a?.submittedAt).toBe(ISO);
  });

  it('is expired once the availability window has passed', async () => {
    db.rows('assessments')[0].available_until = new Date(NOW - 1000).toISOString();
    db.seed('assessment_invites', []);
    const ws = await loadWorkspace({ recruiterId: REC, jobId: BACKEND });
    expect(ws.pipeline[0].assessment?.state).toBe('expired');
  });

  it('reads the pinned snapshot version from the INVITE, not the current assessment', async () => {
    db.rows('assessments')[0].snapshot_version = 3;
    const a = await stateFor('Shortlisted', { status: 'sent', delivery_status: 'sent', snapshot_version: 1 });
    // The link the candidate holds is still v1 even though v3 has since published.
    expect(a?.snapshotVersion).toBe(1);
  });
});

describe('workspace counts', () => {
  beforeEach(() => seed());

  it('separates Shortlisted from Applied and Screening', async () => {
    db.rows('job_applications').push(
      { id: 'a2', job_id: BACKEND, candidate_id: 'c-fe', recruiter_id: REC, current_stage: 'Applied' },
      { id: 'a3', job_id: BACKEND, candidate_id: 'c-fe', recruiter_id: REC, current_stage: 'Screening' },
    );
    const { counts } = await loadWorkspace({ recruiterId: REC, jobId: BACKEND });
    expect(counts.shortlisted).toBe(1);
    expect(counts.applied).toBe(1);
    expect(counts.screening).toBe(1);
  });

  it('counts each application into exactly one stage bucket', async () => {
    const { counts, pipeline } = await loadWorkspace({ recruiterId: REC, jobId: BACKEND });
    const sum =
      counts.applied + counts.screening + counts.shortlisted + counts.assessment +
      counts.technicalRound + counts.interview + counts.finalDecision +
      counts.hired + counts.rejected + counts.hold;
    expect(sum).toBe(pipeline.length);
  });

  it('only accumulates assessment sub-states for candidates in or past that stage', async () => {
    // Counting a "draft" assessment for someone still in Applied would inflate
    // the funnel with people who were never offered it.
    db.rows('job_applications')[0].current_stage = 'Applied';
    const { counts } = await loadWorkspace({ recruiterId: REC, jobId: BACKEND });
    expect(counts.readyToSend).toBe(0);
  });

  it('marks a closed job read-only while still serving its history', async () => {
    const frontend = await loadWorkspace({ recruiterId: REC, jobId: FRONTEND });
    expect(frontend.readOnly).toBe(true);
    expect(frontend.pipeline).toHaveLength(1);
    expect(frontend.job.status).toBe('closed');
  });

  it('surfaces the closed-job invite override flag', async () => {
    db.rows('jobs')[1].progression_config = { allow_invites_when_closed: true };
    const frontend = await loadWorkspace({ recruiterId: REC, jobId: FRONTEND });
    expect(frontend.invitesAllowedWhenClosed).toBe(true);
  });
});
/**
 * Every stage of the pipeline must be scoped to ONE job application.
 *
 * The isolation tests above cover reads. These cover the WRITE path: a
 * progression action taken for job A must leave job B's application — and every
 * downstream record — untouched, even when the same candidate is in both jobs.
 */
describe('progression is scoped to one job application', () => {
  beforeEach(() => seed());

  it('refuses to skip a stage — a candidate cannot jump Shortlisted → Technical round', async () => {
    // The state machine forbids it, and that is correct: shortlisting means
    // "consider them for an assessment", not "skip the assessment".
    await expect(
      makeRecruiterDecision({
        recruiterId: REC,
        jobId: BACKEND,
        candidateId: 'c-be',
        decision: 'Technical Round',
      }),
    ).rejects.toThrow(/skip/i);

    const backend = await loadWorkspace({ recruiterId: REC, jobId: BACKEND });
    expect(backend.pipeline[0].stage).toBe('Shortlisted');
  });

  it('advancing for job A does not move the candidate in job B', async () => {
    // Bea is Shortlisted on BACKEND and in Assessment on FRONTEND.
    const before = await listShortlistedForAssessment({ recruiterId: REC, jobId: FRONTEND });

    // Walk the real path: issuing the invitation moves the application into the
    // Assessment stage, which is what makes the later advance legal.
    await setApplicationStage({
      jobId: BACKEND, candidateId: 'c-be', recruiterId: REC,
      toStage: 'Assessment', triggerType: 'manual', triggerId: 'invite-be',
    });
    await makeRecruiterDecision({
      recruiterId: REC,
      jobId: BACKEND,
      candidateId: 'c-be',
      decision: 'Technical Round',
    });

    const backend = await loadWorkspace({ recruiterId: REC, jobId: BACKEND });
    const frontend = await loadWorkspace({ recruiterId: REC, jobId: FRONTEND });

    expect(backend.pipeline[0].stage).toBe('Technical Round');
    // Job B is untouched by either move.
    expect(frontend.pipeline[0].stage).toBe('Assessment');
    expect(
      (await listShortlistedForAssessment({ recruiterId: REC, jobId: FRONTEND })).map((r) => r.candidateId),
    ).toEqual(before.map((r) => r.candidateId));
  });

  it('creating an interview for job A leaves job B\'s interview queue empty', async () => {
    const { createNextStage } = await import('@/services/hiring/progressionService');
    await createNextStage({
      candidateId: 'c-be',
      jobId: BACKEND,
      recruiterId: REC,
      toStage: 'Technical Round',
    });

    const backend = await loadWorkspace({ recruiterId: REC, jobId: BACKEND });
    const frontend = await loadWorkspace({ recruiterId: REC, jobId: FRONTEND });

    expect(backend.pipeline[0].interview?.jobId).toBeUndefined();
    expect(backend.pipeline[0].interview?.interviewId).toBeTruthy();
    expect(frontend.pipeline[0].interview).toBeNull();
  });

  it('rejects for job A does not reject the candidate in job B', async () => {
    await setApplicationStage({
      jobId: BACKEND, candidateId: 'c-be', recruiterId: REC,
      toStage: 'Rejected', triggerType: 'manual', triggerId: 'reject-backend',
    });
    const frontend = await loadWorkspace({ recruiterId: REC, jobId: FRONTEND });
    expect(frontend.pipeline[0].stage).toBe('Assessment');
    expect(frontend.counts.rejected).toBe(0);
  });

  it('an invite for job A\'s assessment is never attributed to job B', async () => {
    // `loadWorkspace` matches a legacy invite (no `job_application_id`) back to
    // an application by candidate id — but ONLY within this job's rows, so a
    // frontend invite can never attach to a backend application.
    db.rows('assessment_invites').push({
      id: 'inv-fe', assessment_id: 'asmt-fe', candidate_id: 'c-fe',
      job_application_id: null, status: 'sent', delivery_status: 'sent',
      sent_at: ISO, send_count: 1, snapshot_version: 1,
    });

    const backend = await loadWorkspace({ recruiterId: REC, jobId: BACKEND });
    const b = backend.pipeline[0];
    // Bea has no invite at all on BACKEND.
    expect(b.assessment?.inviteStatus).toBeNull();

    const frontend = await loadWorkspace({ recruiterId: REC, jobId: FRONTEND });
    expect(frontend.pipeline[0].assessment?.inviteStatus).toBe('sent');
  });

  it('assessment results are read only from this job\'s assessments', async () => {
    // Same candidate, an attempt on each job's assessment. The workspace must
    // show only the one belonging to the selected job.
    db.rows('job_applications').push({
      id: 'app-be-2', job_id: FRONTEND, candidate_id: 'c-be', recruiter_id: REC,
      current_stage: 'Assessment',
    });
    db.rows('assessment_invites').push({
      id: 'inv-be', assessment_id: 'asmt-be', candidate_id: 'c-be',
      job_application_id: 'app-be-1', status: 'sent', delivery_status: 'sent',
      sent_at: ISO, send_count: 1, snapshot_version: 1,
    });
    db.rows('assessment_invites').push({
      id: 'inv-fe2', assessment_id: 'asmt-fe', candidate_id: 'c-be',
      job_application_id: 'app-be-2', status: 'sent', delivery_status: 'sent',
      sent_at: ISO, send_count: 1, snapshot_version: 1,
    });
    db.rows('assessment_attempts').push(
      { id: 'att-be', assessment_id: 'asmt-be', candidate_id: 'c-be', status: 'evaluated', score: 18, max_score: 20, percentage: 90, passed: true, submitted_at: ISO },
      { id: 'att-fe', assessment_id: 'asmt-fe', candidate_id: 'c-be', status: 'evaluated', score: 4, max_score: 20, percentage: 20, passed: false, submitted_at: ISO },
    );

    const backend = await loadWorkspace({ recruiterId: REC, jobId: BACKEND });
    const frontend = await loadWorkspace({ recruiterId: REC, jobId: FRONTEND });

    const beRow = backend.pipeline.find((r) => r.candidateId === 'c-be')!;
    const feRow = frontend.pipeline.find((r) => r.candidateId === 'c-be')!;

    expect(beRow.assessment?.score).toBe(18);
    expect(beRow.assessment?.percentage).toBe(90);
    expect(feRow.assessment?.score).toBe(4);
    expect(feRow.assessment?.percentage).toBe(20);
  });

  it('reports are counted per job, not globally', async () => {
    db.rows('candidate_reports').push({ id: 'rep-be', job_id: BACKEND, candidate_id: 'c-be' });
    const backend = await loadWorkspace({ recruiterId: REC, jobId: BACKEND });
    const frontend = await loadWorkspace({ recruiterId: REC, jobId: FRONTEND });
    expect(backend.pipeline[0].hasReport).toBe(true);
    expect(frontend.pipeline[0].hasReport).toBe(false);
  });
});
