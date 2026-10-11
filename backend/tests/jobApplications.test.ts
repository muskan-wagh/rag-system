import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * `job_applications` is the authoritative candidate↔job link. These tests pin
 * the two properties the inferred-membership design could not guarantee:
 * duplicate prevention and ownership enforcement.
 */

type Row = Record<string, unknown>;

const jobsTable: Row[] = [];
const candidatesTable: Row[] = [];
const applicationsTable: Row[] = [];

function eqMatch(row: Row, filters: Array<[string, unknown]>): boolean {
  return filters.every(([k, v]) => row[k] === v);
}

/**
 * Minimal but faithful Supabase query-builder double:
 * chains eq/order/range, awaits as an array (select) or a single row
 * (maybeSingle), and applies update/delete/upsert to the backing array.
 */
function makeQuery(rows: () => Row[], initialKind: string) {
  const filters: Array<[string, unknown]> = [];
  let patch: Row = {};
  let kind = initialKind;

  const terminal = () => {
    if (kind === 'select') {
      return { data: rows().filter((r) => eqMatch(r, filters)), error: null };
    }
    if (kind === 'update') {
      const hits = rows().filter((r) => eqMatch(r, filters));
      hits.forEach((h) => Object.assign(h, patch));
      return { data: hits[0] ?? null, error: null };
    }
    if (kind === 'delete') {
      for (let i = rows().length - 1; i >= 0; i -= 1) {
        if (eqMatch(rows()[i], filters)) rows().splice(i, 1);
      }
      return { data: null, error: null };
    }
    return { data: null, error: null };
  };

  const q: Record<string, unknown> = {
    select: () => q,
    eq: (column: string, value: unknown) => {
      filters.push([column, value]);
      return q;
    },
    order: () => q,
    range: () => q,
    update: (payload: Row) => {
      patch = payload;
      kind = 'update';
      return q;
    },
    delete: () => {
      kind = 'delete';
      return q;
    },
    upsert: (payload: Row, opts?: { ignoreDuplicates?: boolean }) => {
      if (opts?.ignoreDuplicates) {
        const conflict = rows().find(
          (r) => r.job_id === payload.job_id && r.candidate_id === payload.candidate_id,
        );
        if (conflict) {
          // Real Supabase returns no row when the conflict is ignored.
          const q2: Record<string, unknown> = {
            select: () => q2,
            then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
              Promise.resolve({ data: null, error: null }).then(res, rej),
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          };
          return q2;
        }
      }
      rows().push({ id: `ja-${rows().length + 1}`, ...payload });
      return q;
    },
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(terminal()).then(res, rej),
    maybeSingle: () => {
      const res = terminal();
      const data = Array.isArray(res.data) ? (res.data[0] ?? null) : res.data;
      return Promise.resolve({ data, error: null });
    },
    single: () => {
      const res = terminal();
      const data = Array.isArray(res.data) ? (res.data[0] ?? null) : res.data;
      return Promise.resolve({ data, error: null });
    },
  };
  return q;
}

vi.mock('@/services/supabase/client', () => ({
  getSupabaseClient: () => ({
    from: (table: string) => {
      if (table === 'jobs') return makeQuery(() => jobsTable, 'select');
      if (table === 'candidates') return makeQuery(() => candidatesTable, 'select');
      if (table === 'job_applications') return makeQuery(() => applicationsTable, 'select');
      if (table === 'job_pipeline') {
        // Mirror the real view: it projects `current_stage AS stage` and
        // excludes rows that have no job_id. Re-derived per access so writes
        // to the backing table are immediately visible.
        return makeQuery(
          () =>
            applicationsTable
              .filter((r) => r.job_id !== null && r.job_id !== undefined)
              .map((r) => ({ ...r, stage: r.current_stage })),
          'select',
        );
      }
      return makeQuery(() => applicationsTable, 'select');
    },
  }),
}));

import {
  enrollCandidate,
  getApplication,
  listJobPipeline,
  getJobStageCounts,
  setApplicationStage,
} from '@/services/hiring/jobApplicationService';
import { AppError } from '@/middleware/errorHandler';

describe('job_applications service', () => {
  beforeEach(() => {
    jobsTable.length = 0;
    candidatesTable.length = 0;
    applicationsTable.length = 0;
    jobsTable.push({ id: 'job-1', recruiter_id: 'rec-1' });
    candidatesTable.push({ id: 'cand-1', recruiter_id: 'rec-1' });
    candidatesTable.push({ id: 'cand-2', recruiter_id: 'rec-2' });
  });

  it('enrols a candidate into a job', async () => {
    const app = await enrollCandidate({ jobId: 'job-1', candidateId: 'cand-1', recruiterId: 'rec-1' });
    expect(app.candidate_id).toBe('cand-1');
    expect(app.job_id).toBe('job-1');
    expect(app.current_stage).toBe('Applied');
  });

  it('prevents the same candidate being applied to the same job twice', async () => {
    await enrollCandidate({ jobId: 'job-1', candidateId: 'cand-1', recruiterId: 'rec-1' });
    await enrollCandidate({ jobId: 'job-1', candidateId: 'cand-1', recruiterId: 'rec-1' });
    expect(applicationsTable.filter((r) => r.candidate_id === 'cand-1')).toHaveLength(1);
  });

  it('refuses to enrol a candidate owned by another recruiter', async () => {
    await expect(
      enrollCandidate({ jobId: 'job-1', candidateId: 'cand-2', recruiterId: 'rec-1' }),
    ).rejects.toBeInstanceOf(AppError);
    expect(applicationsTable).toHaveLength(0);
  });

  it('refuses to enrol into a job owned by another recruiter', async () => {
    jobsTable.push({ id: 'job-9', recruiter_id: 'rec-2' });
    await expect(
      enrollCandidate({ jobId: 'job-9', candidateId: 'cand-1', recruiterId: 'rec-1' }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('does not leak existence: an unowned job returns 404, not 403', async () => {
    try {
      await enrollCandidate({ jobId: 'job-missing', candidateId: 'cand-1', recruiterId: 'rec-1' });
      throw new Error('expected rejection');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(404);
    }
  });

  it('lists a job pipeline with one row per candidate', async () => {
    await enrollCandidate({ jobId: 'job-1', candidateId: 'cand-1', recruiterId: 'rec-1' });
    const rows = await listJobPipeline('job-1', 'rec-1');
    expect(rows).toHaveLength(1);
    expect(rows[0].candidate_id).toBe('cand-1');
  });

  it('filters the VIEW by `stage`, not the table\'s `current_stage`', async () => {
    // `job_pipeline` aliases current_stage -> stage. Filtering by
    // `current_stage` against the view would be rejected by PostgREST.
    await enrollCandidate({ jobId: 'job-1', candidateId: 'cand-1', recruiterId: 'rec-1' });
    const rows = await listJobPipeline('job-1', 'rec-1', { stage: 'Applied' });
    expect(rows).toHaveLength(1);
    const none = await listJobPipeline('job-1', 'rec-1', { stage: 'Hired' });
    expect(none).toHaveLength(0);
  });

  it('refuses to list a pipeline for a job the recruiter does not own', async () => {
    jobsTable.push({ id: 'job-9', recruiter_id: 'rec-2' });
    await expect(listJobPipeline('job-9', 'rec-1')).rejects.toBeInstanceOf(AppError);
  });

  it('counts each candidate into exactly one stage bucket', async () => {
    await enrollCandidate({ jobId: 'job-1', candidateId: 'cand-1', recruiterId: 'rec-1' });
    const counts = await getJobStageCounts('job-1', 'rec-1');
    expect(counts).toEqual({ Applied: 1 });
  });

  it('enforces the transition matrix when moving a job-scoped stage', async () => {
    await enrollCandidate({ jobId: 'job-1', candidateId: 'cand-1', recruiterId: 'rec-1' });

    // Forward single step is allowed.
    const ok = await setApplicationStage('job-1', 'cand-1', 'Screening');
    expect(ok.updated).toBe(true);

    // Skipping stages is not.
    const skip = await setApplicationStage('job-1', 'cand-1', 'Technical Interview');
    expect(skip.updated).toBe(false);
    expect(skip.reason).toMatch(/skip/i);

    // Backwards is not.
    const back = await setApplicationStage('job-1', 'cand-1', 'Applied');
    expect(back.updated).toBe(false);
    expect(back.reason).toMatch(/backwards/i);
  });

  it('never allows an automated hire through the job-scoped stage API', async () => {
    await enrollCandidate({ jobId: 'job-1', candidateId: 'cand-1', recruiterId: 'rec-1' });
    for (const stage of ['Screening', 'Assessment', 'Technical Interview', 'Managerial/HR', 'Offer']) {
      const r = await setApplicationStage('job-1', 'cand-1', stage);
      expect(r.updated).toBe(true);
    }
    const hire = await setApplicationStage('job-1', 'cand-1', 'Hired');
    expect(hire.updated).toBe(false);
    expect(hire.reason).toMatch(/recruiter/i);
    expect((await getApplication('job-1', 'cand-1'))?.current_stage).toBe('Offer');
  });

  it('treats a repeat move as a no-op rather than an error', async () => {
    await enrollCandidate({ jobId: 'job-1', candidateId: 'cand-1', recruiterId: 'rec-1' });
    await setApplicationStage('job-1', 'cand-1', 'Screening');
    const again = await setApplicationStage('job-1', 'cand-1', 'Screening');
    expect(again.updated).toBe(false);
    expect(again.reason).toMatch(/already/i);
  });

  it('refuses to move a candidate who is not in the job', async () => {
    await expect(setApplicationStage('job-1', 'cand-1', 'Screening')).rejects.toBeInstanceOf(AppError);
  });

  it('stores stages on `current_stage`, the column the live table already has', async () => {
    // Regression guard: the live `job_applications` table predates this
    // codebase and uses `current_stage`, not `stage`. Writing `stage` would
    // have created a second, competing source of truth.
    await enrollCandidate({ jobId: 'job-1', candidateId: 'cand-1', recruiterId: 'rec-1' });
    await setApplicationStage('job-1', 'cand-1', 'Screening');
    const stored = applicationsTable.find((r) => r.candidate_id === 'cand-1') as Row;
    expect(stored.current_stage).toBe('Screening');
    expect(stored).not.toHaveProperty('stage');
  });

  it('allows any stage to end in an outcome', async () => {
    await enrollCandidate({ jobId: 'job-1', candidateId: 'cand-1', recruiterId: 'rec-1' });
    const rejected = await setApplicationStage('job-1', 'cand-1', 'Rejected');
    expect(rejected.updated).toBe(true);
  });
});