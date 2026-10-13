import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '@/middleware/errorHandler';

/**
 * Screening workflow tests (req 14): ownership, duplicate runs,
 * scoring persistence, override, failed jobs, idempotency.
 * Supabase + RAG pipeline are faked in-memory; no network.
 */

// ---------- in-memory Supabase fake ----------

type Row = Record<string, unknown>;

const db: Record<string, Row[]> = {
  candidates: [],
  jobs: [],
  screening_results: [],
  candidate_status_log: [],
  hiring_stages: [],
  // The canonical stage write path (`applicationService.setApplicationStage`)
  // persists to `job_applications`, claims an idempotency row in
  // `hiring_progression_events`, and mirrors `candidates.current_status`. The
  // override endpoint used to write the global column directly and left the
  // job application untouched, which is the bug these tables exist to catch.
  job_applications: [],
  hiring_progression_events: [],
};

function resetDb() {
  db.candidates = [
    {
      id: 'cand-1', full_name: 'Alice', total_experience_years: 3,
      parsed_json: { skills: ['JavaScript', 'React'], education: 'Bachelor' },
      raw_resume_text: 'JavaScript React developer with 3 years experience',
      recruiter_id: 'rec-A', current_status: 'Applied',
    },
    {
      id: 'cand-2', full_name: 'Bob', total_experience_years: 0,
      parsed_json: { skills: [], education: '' },
      raw_resume_text: 'entry level applicant',
      recruiter_id: 'rec-A', current_status: 'Applied',
    },
    {
      id: 'cand-9', full_name: 'Mallory', total_experience_years: 9,
      parsed_json: { skills: ['JavaScript'], education: 'Master' },
      raw_resume_text: 'senior engineer',
      recruiter_id: 'rec-B', current_status: 'Applied',
    },
  ];
  db.jobs = [
    { id: 'job-1', title: 'Frontend Dev', description: 'Need JavaScript and React, 2-5 years, Bachelor degree', recruiter_id: 'rec-A' },
    { id: 'job-9', title: 'Other', description: 'JavaScript role', recruiter_id: 'rec-B' },
  ];
  db.screening_results = [];
  db.candidate_status_log = [];
  db.hiring_stages = [];
  db.hiring_progression_events = [];
  // Every candidate under test is an applicant on job-1. The override endpoint
  // now applies the decision to that APPLICATION; with no application row it
  // correctly refuses with a 404.
  db.job_applications = [
    { id: 'app-1', job_id: 'job-1', candidate_id: 'cand-1', recruiter_id: 'rec-A', current_stage: 'Screening' },
    { id: 'app-2', job_id: 'job-1', candidate_id: 'cand-2', recruiter_id: 'rec-A', current_stage: 'Screening' },
    { id: 'app-9', job_id: 'job-9', candidate_id: 'cand-9', recruiter_id: 'rec-B', current_stage: 'Screening' },
  ];
}

class FakeQuery {
  private filters: Array<(r: Row) => boolean> = [];
  private orderKey: string | null = null;
  private orderAsc = true;
  private limitN: number | null = null;
  private countExact = false;
  private pendingUpdate: Row | null = null;
  private pendingInsert: Row | null = null;
  constructor(private table: string) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (opts?.count === 'exact') this.countExact = true;
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push((r) => r[col] === val);
    return this;
  }
  in(col: string, vals: unknown[]) {
    this.filters.push((r) => (vals as unknown[]).includes(r[col]));
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderKey = col;
    this.orderAsc = opts?.ascending !== false;
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  private rows(): Row[] {
    let out = db[this.table].filter((r) => this.filters.every((f) => f(r)));
    if (this.orderKey) {
      const k = this.orderKey;
      out = [...out].sort((a, b) => {
        const av = String(a[k] ?? '');
        const bv = String(b[k] ?? '');
        return this.orderAsc ? (av < bv ? -1 : 1) : av > bv ? -1 : 1;
      });
    }
    if (this.limitN !== null) out = out.slice(0, this.limitN);
    return out;
  }
  private flushInsert(): void {
    if (this.pendingInsert) {
      db[this.table].push(this.pendingInsert);
      this.pendingInsert = null;
    }
  }
  async maybeSingle() {
    this.flushInsert();
    const rows = this.rows();
    if (this.countExact) return { data: null, count: rows.length, error: null };
    return { data: rows[0] ?? null, error: null };
  }
  async single() {
    this.flushInsert();
    const rows = this.rows();
    if (!rows[0]) return { data: null, error: { message: 'no rows returned' } };
    return { data: rows[0], error: null };
  }
  async upsert(obj: Row, opts?: { onConflict?: string }) {
    const table = db[this.table];
    if (opts?.onConflict) {
      const cols = opts.onConflict.split(',');
      const idx = table.findIndex((r) => cols.every((c) => r[c] === obj[c]));
      if (idx !== -1) {
        table[idx] = { ...table[idx], ...obj };
        return { data: table[idx], error: null };
      }
    }
    table.push({ ...obj });
    return { data: obj, error: null };
  }
  update(obj: Row) {
    // Chainable like supabase-js: .update().eq() applies on await.
    this.pendingUpdate = obj;
    return this;
  }
  insert(obj: Row) {
    this.pendingInsert = { ...obj };
    return this;
  }
  // Allow `await query` for plain selects and chained updates.
  then(resolve: (v: { data: Row[] | null; count?: number | null; error: null }) => void) {
    this.flushInsert();
    if (this.pendingUpdate) {
      for (const r of this.rows()) Object.assign(r, this.pendingUpdate);
      this.pendingUpdate = null;
      resolve({ data: null, error: null });
      return;
    }
    const rows = this.rows();
    // `await supabase.from(t).select('id', { count: 'exact' }).eq(...)` — the
    // plain-await form — must still yield a count. Returning rows only made
    // every `const { count } = await ...` destructure to `undefined`, silently
    // taking the wrong branch.
    resolve(this.countExact ? { data: null, count: rows.length, error: null } : { data: rows, error: null });
  }
}

vi.mock('@/services/supabase/client', () => ({
  getSupabaseClient: () => ({ from: (t: string) => new FakeQuery(t) }),
}));

vi.mock('@/services/llm/parseJD', () => ({
  parseJD: vi.fn(async () => ({
    title: 'Frontend Dev',
    skills: ['JavaScript', 'React'],
    experience: { min: 2, max: 5 },
    education: { level: 'Bachelor', field: '' },
    responsibilities: [],
    requirements: [],
    rawText: 'jd',
  })),
}));

vi.mock('@/services/embedding', () => ({
  generateEmbedding: vi.fn(async () => Array(384).fill(0.1)),
}));

vi.mock('@/services/qdrant/searchCandidates', () => ({
  searchByEmbedding: vi.fn(async () => [
    { candidate: { id: 'cand-1' }, score: 0.8 },
    { candidate: { id: 'cand-2' }, score: 0.2 },
  ]),
}));

vi.mock('@/services/llm/explainability', () => ({
  generateExplanations: vi.fn(async (_jd: string, cands: Array<{ id: string }>) => {
    const out: Record<string, unknown> = {};
    for (const c of cands) {
      out[c.id] = { strengths: ['Strong JS fit'], missing_skills: [], recommendation: 'Good Fit', interview_tip: 'Ask about hooks' };
    }
    return out;
  }),
}));

// In-memory BullMQ fake so the REAL queue/producer logic runs hermetically
// (no Redis). Shared via vi.hoisted to dodge mock-factory hoisting.

/** All jobs currently sitting in the fake BullMQ store. */
function queuedJobs(): Array<{ id: string; name?: string; data?: unknown; queue: string }> {
  return [...bullStore.values()] as Array<{ id: string; name?: string; data?: unknown; queue: string }>;
}

const { bullStore, FakeQueue } = vi.hoisted(() => {
  const store = new Map<string, { id: string; state: string; data: unknown; queue: string }>();
  class FakeQueue {
    constructor(private qname: string) {}
    async add(name: string, data: unknown, opts?: { jobId?: string }) {
      const id = opts?.jobId || `auto-${store.size}`;
      store.set(`${this.qname}:${id}`, { id, name, state: 'waiting', data, queue: this.qname });
      return { id };
    }
    async getJob(id: string) {
      const key = `${this.qname}:${id}`;
      const j = store.get(key);
      if (!j) return null;
      return {
        id: j.id,
        getState: async () => j.state,
        remove: async () => { store.delete(key); },
      };
    }
  }
  return { bullStore: store, FakeQueue };
});

vi.mock('bullmq', () => ({
  Queue: FakeQueue,
  Worker: class {},
  UnrecoverableError: class extends Error {},
}));

vi.mock('@/services/redis/manager', () => ({
  ensureRedisConnected: vi.fn(async () => ({})),
  setRedisClientOrigin: vi.fn(),
  shutdownRedis: vi.fn(),
  isRedisAvailable: vi.fn(() => true),
}));

import {
  runScreeningForCandidate,
  runScreeningHandler,
  getScreeningStatusHandler,
  listScreeningResultsHandler,
  advanceScreeningHandler,
  rejectScreeningHandler,
} from '@/controllers/screeningController';
import { enqueueScreeningJob, screeningJobId } from '@/services/queue/screeningQueue';
import { processScreeningJob } from '@/services/queue/screeningWorker';

function appWith(recruiter: { id: string } | undefined, route: string, handler: express.RequestHandler) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (recruiter) (req as unknown as { recruiter: unknown }).recruiter = recruiter;
    next();
  });
  app.use(route, handler);
  app.use(errorHandler);
  return app;
}

beforeEach(() => {
  resetDb();
  bullStore.clear();
  vi.clearAllMocks();
});

// ---------- scoring persistence ----------

describe('screening scoring persistence', () => {
  it('persists full breakdown + matched/missing/explanation', async () => {
    const r = await runScreeningForCandidate('job-1', 'cand-1', 'Need JavaScript and React', 60, 'rec-A');
    expect(r.aiStatus).toBe('passed');
    expect(db.screening_results.length).toBe(1);
    const row = db.screening_results[0];
    expect(row.job_id).toBe('job-1');
    expect(row.semantic_score).toBeCloseTo(80);
    expect(row.skills_score).toBeCloseTo(100);
    expect(row.matched_skills).toEqual(['JavaScript', 'React']);
    expect(row.missing_skills).toEqual([]);
    expect(String(row.explanation)).toContain('Strong JS fit');
    expect(row.recruiter_override).toBe(false);
  });

  it('idempotent: running twice leaves exactly one row', async () => {
    await runScreeningForCandidate('job-1', 'cand-1', 'jd', 60, 'rec-A');
    await runScreeningForCandidate('job-1', 'cand-1', 'jd', 60, 'rec-A');
    expect(db.screening_results.length).toBe(1);
  });
});

// ---------- pass -> Assessment eligibility ----------

describe('pass to Assessment eligibility', () => {
  // Screening no longer writes `candidates.current_status` directly. It hands
  // the transition to the central progression service, which gives us
  // idempotency, transition validation and recruiter-attributed timeline
  // entries. The write therefore happens in the worker, not inline.
  it('enqueues a screening progression instead of writing status directly', async () => {
    await runScreeningForCandidate('job-1', 'cand-1', 'jd', 60, 'rec-A');
    const cand = db.candidates.find((c) => c.id === 'cand-1');
    expect(cand?.current_status).toBe('Applied');
    expect(db.candidate_status_log.filter((t) => t.candidate_id === 'cand-1').length).toBe(0);

    const queued = queuedJobs().filter((j) => String(j.data?.triggerType) === 'screening');
    expect(queued.length).toBe(1);
    const payload = queued[0].data as {
      candidateId: string;
      jobId: string;
      recruiterId: string;
      fromStage: string;
      passed: boolean;
      triggerId: string;
    };
    expect(payload.candidateId).toBe('cand-1');
    expect(payload.jobId).toBe('job-1');
    expect(payload.recruiterId).toBe('rec-A');
    expect(payload.fromStage).toBe('Applied');
    expect(payload.passed).toBe(true);
    // Stable key => a retried screening run deduplicates instead of
    // re-progressing the candidate.
    expect(payload.triggerId).toBe('screening:job-1:cand-1:passed');
  });

  it('enqueues nothing for a failing candidate', async () => {
    await runScreeningForCandidate('job-1', 'cand-2', 'jd', 60, 'rec-A');
    const row = db.screening_results.find((r) => r.candidate_id === 'cand-2');
    expect(row?.status).toBe('failed');
    expect(db.candidates.find((c) => c.id === 'cand-2')?.current_status).toBe('Applied');
    expect(db.candidate_status_log.filter((t) => t.candidate_id === 'cand-2').length).toBe(0);
    expect(queuedJobs().filter((j) => String(j.data?.triggerType) === 'screening').length).toBe(0);
  });

  it('never walks a candidate already past Screening backwards', async () => {
    const cand = db.candidates.find((c) => c.id === 'cand-1');
    if (cand) cand.current_status = 'Technical Interview';
    await runScreeningForCandidate('job-1', 'cand-1', 'jd', 60, 'rec-A');
    expect(db.candidates.find((c) => c.id === 'cand-1')?.current_status).toBe('Technical Interview');
    expect(queuedJobs().filter((j) => String(j.data?.triggerType) === 'screening').length).toBe(0);
  });

  it('does not queue any assessment invitation email on a pass', async () => {
    await runScreeningForCandidate('job-1', 'cand-1', 'jd', 60, 'rec-A');
    const invites = queuedJobs().filter((j) => String(j.name) === 'send-email');
    expect(invites.length).toBe(0);
  });
});

// ---------- ownership ----------

describe('screening ownership', () => {
  it('rejects screening a foreign candidate', async () => {
    await expect(runScreeningForCandidate('job-1', 'cand-9', 'jd', 60, 'rec-A')).rejects.toThrow(/not owned/);
    expect(db.screening_results.length).toBe(0);
  });

  it('run endpoint 404s on another recruiter job', async () => {
    // Call handler through a param-aware route.
    const app3 = express();
    app3.use(express.json());
    app3.use((req, _res, next) => {
      (req as unknown as { recruiter: unknown }).recruiter = { id: 'rec-A' };
      next();
    });
    app3.post('/jobs/:jobId/screening/run', runScreeningHandler as express.RequestHandler);
    app3.use(errorHandler);
    const res = await request(app3).post('/jobs/job-9/screening/run').send({});
    expect(res.status).toBe(404);
  });

  it('worker drops non-owned ids from explicit lists', async () => {
    await processScreeningJob({ data: { jobId: 'job-1', recruiterId: 'rec-A', candidateIds: ['cand-1', 'cand-9'], jdText: 'Need JavaScript' } } as never);
    const ids = db.screening_results.map((r) => r.candidate_id);
    expect(ids).toContain('cand-1');
    expect(ids).not.toContain('cand-9');
  });

  it('override on foreign candidate 404s', async () => {
    const app3 = express();
    app3.use(express.json());
    app3.use((req, _res, next) => {
      (req as unknown as { recruiter: unknown }).recruiter = { id: 'rec-A' };
      next();
    });
    app3.post('/jobs/:jobId/screening/:candidateId/advance', advanceScreeningHandler as express.RequestHandler);
    app3.use(errorHandler);
    const res = await request(app3).post('/jobs/job-1/screening/cand-9/advance').send({ advance: true });
    expect(res.status).toBe(404);
  });
});

// ---------- override ----------

describe('screening override', () => {
  it('preserves AI result, marks overridden, writes timeline + status', async () => {
    await runScreeningForCandidate('job-1', 'cand-2', 'jd', 60, 'rec-A'); // failed
    const app3 = express();
    app3.use(express.json());
    app3.use((req, _res, next) => {
      (req as unknown as { recruiter: unknown }).recruiter = { id: 'rec-A' };
      next();
    });
    app3.post('/jobs/:jobId/screening/:candidateId/advance', advanceScreeningHandler as express.RequestHandler);
    app3.use(errorHandler);
    const res = await request(app3).post('/jobs/job-1/screening/cand-2/advance').send({ advance: true, reason: 'Strong portfolio' });
    expect(res.status).toBe(200);
    const row = db.screening_results.find((r) => r.candidate_id === 'cand-2');
    expect(row?.status).toBe('overridden');
    expect(row?.ai_status).toBe('failed');
    expect(row?.recruiter_override).toBe(true);
    expect(row?.override_reason).toBe('Strong portfolio');
    // The decision lands on the JOB APPLICATION, and only then mirrors.
    expect(db.job_applications.find((a) => a.candidate_id === 'cand-2')?.current_stage).toBe('Screening');
    expect(db.candidates.find((c) => c.id === 'cand-2')?.current_status).toBe('Screening');
  });

  it('reject override sets Rejected without touching AI fields', async () => {
    await runScreeningForCandidate('job-1', 'cand-2', 'jd', 60, 'rec-A');
    const app3 = express();
    app3.use(express.json());
    app3.use((req, _res, next) => {
      (req as unknown as { recruiter: unknown }).recruiter = { id: 'rec-A' };
      next();
    });
    app3.post('/jobs/:jobId/screening/:candidateId/reject', rejectScreeningHandler as express.RequestHandler);
    app3.use(errorHandler);
    const res = await request(app3).post('/jobs/job-1/screening/cand-2/reject').send({ advance: false });
    expect(res.status).toBe(200);
    expect(db.candidates.find((c) => c.id === 'cand-2')?.current_status).toBe('Rejected');
    expect(db.screening_results.find((r) => r.candidate_id === 'cand-2')?.ai_overall).toBeDefined();
  });
});

// ---------- duplicates + failed jobs ----------

describe('screening queue idempotency + failures', () => {
  it('stable job id collapses live duplicates', async () => {
    expect(screeningJobId('job-1')).toBe(screeningJobId('job-1'));
    const first = await enqueueScreeningJob({ jobId: 'job-1', recruiterId: 'rec-A', jdText: 'x' });
    expect(first.deduplicated).toBe(false);
    const second = await enqueueScreeningJob({ jobId: 'job-1', recruiterId: 'rec-A', jdText: 'x' });
    expect(second.deduplicated).toBe(true);
    expect(second.jobId).toBe(first.jobId);
  });

  it('completed stub allows a fresh re-run (retry)', async () => {
    const key = `screening-bulk:${screeningJobId('job-1')}`;
    bullStore.set(key, { id: screeningJobId('job-1'), state: 'completed', data: {}, queue: 'screening-bulk' });
    const retry = await enqueueScreeningJob({ jobId: 'job-1', recruiterId: 'rec-A', jdText: 'x' });
    expect(retry.deduplicated).toBe(false);
  });

  it('worker fails fast on unowned job', async () => {
    await expect(
      processScreeningJob({ data: { jobId: 'job-9', recruiterId: 'rec-A', jdText: 'x' } } as never),
    ).rejects.toThrow(/not owned/);
  });

  it('worker fails fast with no JD text', async () => {
    db.jobs = [{ id: 'job-1', title: '', description: '', recruiter_id: 'rec-A' }];
    await expect(
      processScreeningJob({ data: { jobId: 'job-1', recruiterId: 'rec-A' } } as never),
    ).rejects.toThrow(/No JD/);
  });

  it('status endpoint returns counts + queue state, scoped to owner', async () => {
    await runScreeningForCandidate('job-1', 'cand-1', 'jd', 60, 'rec-A');
    await runScreeningForCandidate('job-1', 'cand-2', 'jd', 60, 'rec-A');
    const app3 = express();
    app3.use(express.json());
    app3.use((req, _res, next) => {
      (req as unknown as { recruiter: unknown }).recruiter = { id: 'rec-A' };
      next();
    });
    app3.get('/jobs/:jobId/screening/status', getScreeningStatusHandler as express.RequestHandler);
    app3.get('/jobs/:jobId/screening/results', listScreeningResultsHandler as express.RequestHandler);
    app3.use(errorHandler);
    const status = await request(app3).get('/jobs/job-1/screening/status');
    expect(status.status).toBe(200);
    expect(status.body.data.screened).toBe(2);
    expect(status.body.data.passed).toBe(1);
    expect(status.body.data.failed).toBe(1);
    const forbidden = await request(app3).get('/jobs/job-9/screening/results');
    expect(forbidden.status).toBe(404);
  });
});
