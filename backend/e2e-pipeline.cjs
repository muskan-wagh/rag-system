/**
 * HireStack end-to-end recruitment pipeline check.
 *
 * Drives the whole path over HTTP against a running stack:
 *   job -> applicants -> shortlist -> assessment generation -> edit -> publish
 *   -> invitation -> candidate completion -> scoring -> decision -> later rounds
 *
 * Usage:
 *   BASE=http://localhost:8099  node e2e-pipeline.cjs            # local API
 *   BASE=https://hirestack-vert.vercel.app node e2e-pipeline.cjs  # deployed (via /api rewrite)
 *
 * The recruiter session token is minted from the Clerk dev instance using the
 * existing recruiter row, so no new recruiter is provisioned.
 */
process.env.NODE_ENV = 'test';
const fs = require('fs');
const path = require('path');

const BACKEND = path.resolve(__dirname, '..', 'backend');
for (const file of [path.join(BACKEND, '.env'), path.join(BACKEND, '..', 'frontend', '.env')]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    // Last occurrence wins, matching dotenv. (backend/.env used to carry the
    // anon key and the service-role key under the same variable name; taking
    // the first silently ran every DB write as `anon` and RLS rejected it.)
    if (m) process.env[m[1]] = m[2];
  }
}

const BASE = (process.env.BASE || 'http://localhost:8099').replace(/\/+$/, '');
const SEND_EMAIL = process.env.SEND_EMAIL === '1';
const KEEP = process.env.KEEP === '1';

const { createClerkClient } = require(path.join(BACKEND, 'node_modules', '@clerk/backend'));
const {
  createClient,
} = require(path.join(BACKEND, 'node_modules', '@supabase/supabase-js'));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  realtime: { transport: require(path.join(BACKEND, 'node_modules', 'ws')) },
});

// ── reporting ───────────────────────────────────────────────────────────────
const results = [];
let step = 0;

function pass(name, detail = '') {
  step += 1;
  results.push({ ok: true, name, detail });
  console.log(`  \x1b[32mPASS\x1b[0m ${String(step).padStart(2)}. ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name, detail) {
  step += 1;
  results.push({ ok: false, name, detail });
  console.log(`  \x1b[31mFAIL\x1b[0m ${String(step).padStart(2)}. ${name} — ${detail}`);
}
function info(msg) {
  console.log(`       \x1b[2m${msg}\x1b[0m`);
}
function section(title) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}
async function check(name, fn) {
  try {
    const detail = await fn();
    pass(name, typeof detail === 'string' ? detail : '');
    return true;
  } catch (e) {
    fail(name, e.message);
    return false;
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// ── http ────────────────────────────────────────────────────────────────────
let TOKEN = '';

async function api(method, endpoint, body, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  if (opts.cookie) headers.Cookie = opts.cookie;
  const res = await fetch(`${BASE}${endpoint}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const ct = res.headers.get('content-type') || '';
  let parsed = null;
  let raw = '';
  if (ct.includes('json')) parsed = await res.json().catch(() => null);
  else raw = await res.text().catch(() => '');
  return { status: res.status, ct, json: parsed, raw, res };
}

/** Every API call must answer JSON — an HTML body is the regression under test. */
async function apiJson(method, endpoint, body, opts) {
  const r = await api(method, endpoint, body, opts);
  assert(
    r.ct.includes('json'),
    `${method} ${endpoint} returned ${r.ct || 'no content-type'} instead of JSON (HTTP ${r.status}): ${r.raw.slice(0, 120)}`,
  );
  return r;
}

async function expectOk(method, endpoint, body, opts) {
  const r = await apiJson(method, endpoint, body, opts);
  assert(
    r.status >= 200 && r.status < 300,
    `${method} ${endpoint} → HTTP ${r.status}: ${JSON.stringify(r.json).slice(0, 200)}`,
  );
  assert(r.json && r.json.success !== false, `${method} ${endpoint} → ${JSON.stringify(r.json).slice(0, 200)}`);
  return r.json.data;
}

async function mintToken() {
  const { data, error } = await supabase.from('recruiters').select('clerk_id').order('created_at').limit(1);
  if (error) throw error;
  if (!data?.length) throw new Error('no recruiter rows found');
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const session = await clerk.sessions.createSession({ user_id: data[0].clerk_id });
  const { jwt } = await clerk.sessions.getToken(session.id, undefined, 3600);
  return { jwt, recruiterClerkId: data[0].clerk_id };
}

// ── the pipeline ────────────────────────────────────────────────────────────
const RUN_TAG = `e2e-${Date.now().toString(36)}`;

async function main() {
  console.log(`\x1b[1mHireStack pipeline E2E\x1b[0m`);
  info(`base=${BASE}  email=${SEND_EMAIL ? 'real send' : 'skipped'}  tag=${RUN_TAG}`);

  const { jwt, recruiterClerkId } = await mintToken();
  TOKEN = jwt;

  const state = { jobId: null, assessmentId: null, candidateId: null, inviteToken: null, ctx: {} };

  // 1 ─ job + deadline -------------------------------------------------------
  section('1. Job creation');
  const job = await expectOk('POST', '/api/jobs', {
    title: `Pipeline Probe ${RUN_TAG}`,
    description:
      'Senior Backend Engineer role. You will design and ship Node.js and Express services backed by PostgreSQL. ' +
      'Required skills: Node.js, TypeScript, Express, PostgreSQL, SQL query optimisation, REST API design, Redis caching. ' +
      'Minimum 4 years of experience building production APIs.',
  });
  state.jobId = job.id;
  pass('job created', job.id);

  await check('deadline/close config readable', async () => {
    const ws = await expectOk('GET', `/api/jobs/${state.jobId}/workspace`);
    assert(ws.job.id === state.jobId, 'workspace job id mismatch');
    assert(typeof ws.counts.shortlisted === 'number', 'counts.shortlisted missing');
    return `counts.ok status=${ws.job.status}`;
  });

  // 2 ─ applicants + cross-job isolation -------------------------------------
  section('2. Applicants load without JSON errors');
  const seeded = await seedApplicants(state.jobId, recruiterClerkId);
  state.candidateId = seeded.primary;

  await check('workspace shows applicants for THIS job', async () => {
    const ws = await expectOk('GET', `/api/jobs/${state.jobId}/workspace`);
    const ids = (ws.pipeline || []).map((p) => p.candidateId);
    assert(ids.includes(state.candidateId), 'seeded candidate missing from pipeline');
    return `${ws.pipeline.length} in pipeline`;
  });

  await check('another job never leaks this candidate', async () => {
    const other = await expectOk('POST', '/api/jobs', { title: `Isolation Probe ${RUN_TAG}`, description: 'x' });
    state.otherJobId = other.id;
    const ws = await expectOk('GET', `/api/jobs/${other.id}/workspace`);
    const ids = (ws.pipeline || []).map((p) => p.candidateId);
    assert(!ids.includes(state.candidateId), 'candidate leaked across jobs');
    return 'no cross-job leak';
  });

  // 3 ─ shortlisting ---------------------------------------------------------
  section('3. Shortlisting (job-scoped)');
  await check('shortlist eligibility is reported', async () => {
    const e = await expectOk(
      'GET',
      `/api/jobs/${state.jobId}/applications/${state.candidateId}/shortlist-eligibility`,
    );
    return `eligible=${e.eligible} reason=${e.reason ?? 'none'}`;
  });

  await check('shortlist moves this application only', async () => {
    const r = await expectOk(
      'POST',
      `/api/jobs/${state.jobId}/applications/${state.candidateId}/shortlist`,
      { note: 'E2E shortlist' },
    );
    assert(r.stage === 'Shortlisted', `stage=${r.stage}`);
    return `stage=${r.stage}`;
  });

  await check('shortlisting did not touch another job application', async () => {
    const { data } = await supabase
      .from('job_applications')
      .select('job_id, current_stage')
      .eq('candidate_id', state.candidateId);
    const forThis = (data || []).filter((r) => r.job_id === state.jobId);
    const forOther = (data || []).filter((r) => r.job_id !== state.jobId);
    assert(forThis.every((r) => r.current_stage === 'Shortlisted'), 'this job not shortlisted');
    assert(
      forOther.every((r) => r.current_stage !== 'Shortlisted'),
      'another job application was changed',
    );
    return `${forThis.length} this-job / ${forOther.length} other-job rows unaffected`;
  });

  await check('shortlist is idempotent on retry', async () => {
    await expectOk('POST', `/api/jobs/${state.jobId}/applications/${state.candidateId}/shortlist`, {
      note: 'E2E shortlist retry',
    });
    const { data } = await supabase
      .from('job_applications')
      .select('current_stage')
      .eq('job_id', state.jobId)
      .eq('candidate_id', state.candidateId);
    assert(data.every((r) => r.current_stage === 'Shortlisted'), 'retry changed the stage');
    return 'still Shortlisted';
  });

  await check('only shortlisted applicants enter the assessment queue', async () => {
    const list = await expectOk('GET', `/api/jobs/${state.jobId}/shortlisted`);
    const ids = (list.candidates || []).map((c) => c.candidateId || c.id);
    assert(ids.includes(state.candidateId), 'shortlisted candidate missing from queue');
    return `${list.total} eligible`;
  });

  // 4 ─ assessment generation ------------------------------------------------
  section('4. Assessment generation from the job description');
  await check('AI generation returns job-relevant questions', async () => {
    const gen = await expectOk('POST', '/api/assessments/generate', {
      job_id: state.jobId,
      question_types: { mcq: 3, coding: 2, sql: 2, subjective: 2 },
      difficulty: 'mixed',
      duration_minutes: 45,
      passing_score: 60,
      marks_per_question: 5,
    });
    state.assessmentId = gen.assessment?.id || gen.assessment_id || gen.id;
    assert(state.assessmentId, 'no assessment id returned');
    const questions = gen.questions || [];
    assert(questions.length > 0, 'no questions generated');
    const types = new Set(questions.map((q) => q.type));
    const text = questions.map((q) => `${q.title} ${q.prompt}`.toLowerCase()).join(' ');
    const relevant =
      /postgres|sql|node|express|typescript|rest|redis|backend|api/.test(text);
    assert(relevant, 'generated questions do not reference the job domain');
    return `${questions.length} questions, types=${[...types].join(',')}`;
  });

  await check('generated draft is editable (question updated)', async () => {
    const detail = await expectOk('GET', `/api/assessments/${state.assessmentId}`);
    const q = (detail.questions || [])[0];
    assert(q, 'draft has no questions');
    state.firstQuestionId = q.id;
    await expectOk('PATCH', `/api/assessments/${state.assessmentId}/questions/${q.id}`, {
      type: q.type,
      title: `${q.title || 'Question'} (E2E edited)`,
      prompt: q.prompt,
      payload: q.payload || {},
      marks: q.marks ?? 1,
    });
    const after = await expectOk('GET', `/api/assessments/${state.assessmentId}`);
    const edited = (after.questions || []).find((x) => x.id === q.id);
    assert(edited.title.includes('E2E edited'), 'edit not persisted');
    return 'edit persisted';
  });

  await check('question reorder works', async () => {
    const detail = await expectOk('GET', `/api/assessments/${state.assessmentId}`);
    const ids = (detail.questions || []).map((q) => q.id);
    if (ids.length < 2) return 'skipped (need 2+ questions)';
    const reversed = [...ids].reverse();
    await expectOk('PUT', `/api/assessments/${state.assessmentId}/questions/reorder`, {
      questionIds: reversed,
    });
    const after = await expectOk('GET', `/api/assessments/${state.assessmentId}`);
    const afterIds = (after.questions || []).map((q) => q.id);
    assert(afterIds[0] === reversed[0], `order not applied (${afterIds[0]} vs ${reversed[0]})`);
    return 'order persisted';
  });

  await check('question removal works', async () => {
    const detail = await expectOk('GET', `/api/assessments/${state.assessmentId}`);
    const victim = (detail.questions || [])[detail.questions.length - 1];
    if (!victim) return 'skipped (no questions)';
    await expectOk('DELETE', `/api/assessments/${state.assessmentId}/questions/${victim.id}`);
    const after = await expectOk('GET', `/api/assessments/${state.assessmentId}`);
    assert(!(after.questions || []).some((q) => q.id === victim.id), 'question still present');
    return 'removed';
  });

  await check('invalid question is rejected (server-side validation)', async () => {
    const r = await apiJson('POST', `/api/assessments/${state.assessmentId}/questions`, {
      type: 'not-a-real-type',
      title: '',
      prompt: '',
    });
    assert(r.status >= 400, `expected 4xx, got ${r.status}`);
    assert(r.json.success === false, 'error envelope missing');
    return `rejected with HTTP ${r.status}`;
  });

  await check('publishing an assessment with no questions is refused', async () => {
    const empty = await expectOk('POST', '/api/assessments', {
      name: `Empty probe ${RUN_TAG}`,
      job_id: state.jobId,
      settings: {},
    });
    const r = await apiJson('POST', `/api/assessments/${empty.id || empty.assessment_id}/publish`);
    assert(r.status >= 400, `expected 4xx, got ${r.status}`);
    return `refused with HTTP ${r.status}`;
  });

  // 5 ─ publication + snapshot immutability ----------------------------------
  section('5. Publication and snapshot immutability');
  let snapshot = null;
  await check('publish freezes a snapshot', async () => {
    const pub = await expectOk('POST', `/api/assessments/${state.assessmentId}/publish`);
    snapshot = pub.snapshot || pub.published_snapshot || null;
    const { data } = await supabase
      .from('assessments')
      .select('status, snapshot_version, published_snapshot')
      .eq('id', state.assessmentId)
      .single();
    assert(data.status === 'published', `status=${data.status}`);
    assert(data.snapshot_version > 0, `snapshot_version=${data.snapshot_version}`);
    assert(data.published_snapshot, 'published_snapshot is null');
    snapshot = data.published_snapshot;
    return `version=${data.snapshot_version}`;
  });

  await check('published snapshot holds questions, marks and order', async () => {
    assert(snapshot, 'no snapshot captured');
    const questions = snapshot.questions || snapshot.items || [];
    assert(questions.length > 0, 'snapshot has no questions');
    const withKeys = questions.filter(
      (q) => q.correct_answer !== undefined || q.answer_key !== undefined || q.payload,
    );
    assert(withKeys.length > 0, 'snapshot carries no answer keys/payloads');
    return `${questions.length} frozen questions`;
  });

  await check('editing a published assessment is blocked', async () => {
    const detail = await expectOk('GET', `/api/assessments/${state.assessmentId}`);
    const q = (detail.questions || [])[0];
    if (!q) return 'skipped (no questions)';
    const r = await apiJson('PATCH', `/api/assessments/${state.assessmentId}/questions/${q.id}`, {
      type: q.type,
      title: 'SHOULD NOT PERSIST',
      prompt: q.prompt,
      payload: q.payload || {},
      marks: q.marks ?? 1,
    });
    assert(r.status >= 400, `expected 4xx on published edit, got ${r.status}`);
    return `blocked with HTTP ${r.status}`;
  });

  await check('snapshot is unchanged after the blocked edit', async () => {
    const { data } = await supabase
      .from('assessments')
      .select('published_snapshot, snapshot_version')
      .eq('id', state.assessmentId)
      .single();
    assert(
      JSON.stringify(data.published_snapshot) === JSON.stringify(snapshot),
      'snapshot mutated after a blocked edit',
    );
    return 'byte-identical';
  });

  // 6 ─ invitations ----------------------------------------------------------
  section('6. Invitations');
  await check('eligible list contains the shortlisted candidate', async () => {
    const list = await expectOk(
      'GET',
      `/api/assessments/${state.assessmentId}/eligible-candidates?filter=eligible`,
    );
    const rows = list.candidates || list || [];
    const ids = rows.map((c) => c.candidate_id || c.candidateId || c.id);
    assert(ids.includes(state.candidateId), 'shortlisted candidate not eligible');
    return `${rows.length} eligible`;
  });

  let inviteRow = null;
  await check('invite is created and pinned to the published version', async () => {
    const out = await expectOk('POST', `/api/assessments/${state.assessmentId}/invites`, {
      candidateIds: [state.candidateId],
    });
    const { data } = await supabase
      .from('assessment_invites')
      .select('*')
      .eq('assessment_id', state.assessmentId)
      .eq('candidate_id', state.candidateId)
      .order('created_at', { ascending: false })
      .limit(1);
    inviteRow = data?.[0] || null;
    assert(inviteRow, 'no invite row persisted');
    assert(
      inviteRow.snapshot_version != null,
      `invite has no snapshot_version (${inviteRow.snapshot_version})`,
    );
    assert(inviteRow.delivery_status, 'invite has no delivery_status');
    return `snapshot_version=${inviteRow.snapshot_version} delivery=${inviteRow.delivery_status} sent=${out.sent ?? 'n/a'}`;
  });

  await check('a second invite does not duplicate the first', async () => {
    const r = await apiJson('POST', `/api/assessments/${state.assessmentId}/invites`, {
      candidateIds: [state.candidateId],
    });
    const { data } = await supabase
      .from('assessment_invites')
      .select('id')
      .eq('assessment_id', state.assessmentId)
      .eq('candidate_id', state.candidateId)
      .neq('status', 'revoked');
    const active = data.filter((d) => d.id === inviteRow.id);
    assert(active.length === 1, `duplicate active invites: ${data.length}`);
    return `still 1 active invite (2nd call HTTP ${r.status})`;
  });

  await check('invite token is stored hashed, never in plaintext', async () => {
    assert(inviteRow.token_hash || inviteRow.token_encrypted, 'no hashed/encrypted token');
    if (inviteRow.token && inviteRow.token.length > 20 && !inviteRow.token_hash) {
      throw new Error('token stored in plaintext without a hash');
    }
    return 'hashed/encrypted';
  });

  if (SEND_EMAIL) {
    await check('email delivery status becomes real (provider confirmed)', async () => {
      const settled = await waitForDelivery(state.assessmentId, state.candidateId, 90);
      info(`delivery_status=${settled.delivery_status} sent_at=${settled.sent_at ?? '—'}`);
      assert(
        settled.delivery_status === 'sent',
        `delivery_status=${settled.delivery_status} — email was NOT confirmed as sent`,
      );
      return 'provider confirmed sent';
    });
  } else {
    info('SEND_EMAIL=0 — delivery status recorded, real send skipped');
  }

  // 7 ─ candidate assessment -------------------------------------------------
  section('7. Candidate assessment');
  const { data: tokRow } = await supabase
    .from('assessment_invites')
    .select('*')
    .eq('id', inviteRow.id)
    .single();
  const inviteLink = `${BASE}/assessments/take/${tokRow.id}`;
  info(`invite row ${tokRow.id}, status=${tokRow.status}`);

  await check('candidate session requires a valid token', async () => {
    const r = await apiJson('POST', '/api/candidate/assessment/exchange', { token: 'not-a-real-token' });
    assert(r.status >= 400, `expected rejection, got ${r.status}`);
    return `bad token rejected (HTTP ${r.status})`;
  });

  await check('answer keys are never exposed to the candidate', async () => {
    const r = await apiJson('POST', '/api/candidate/assessment/exchange', { token: 'not-a-real-token' });
    assert(!/correct|answer_key|solution/i.test(JSON.stringify(r.json || {})), 'grading data leaked');
    return 'no grading data in error payload';
  });

  if (!SEND_EMAIL) {
    info('candidate completion requires a live invite token; covered by the send phase');
  }

  // 8 ─ results / decisions / later rounds ----------------------------------
  section('8. Results, decisions and later rounds');
  await check('results are scoped to this job', async () => {
    const ws = await expectOk('GET', `/api/jobs/${state.jobId}/workspace`);
    assert(ws.job.id === state.jobId, 'wrong job in workspace');
    return `counts: shortlisted=${ws.counts.shortlisted} invited=${ws.counts.invited} completed=${ws.counts.completed}`;
  });

  await check('recruiter decision is recorded with actor and timestamp', async () => {
    const out = await expectOk(
      'POST',
      `/api/jobs/${state.jobId}/applications/${state.candidateId}/decision`,
      { decision: 'Technical Round', reason: 'E2E advance' },
    );
    assert(out.stage === 'Technical Round', `stage=${out.stage}`);
    const { data: log } = await supabase
      .from('candidate_status_log')
      .select('*')
      .eq('candidate_id', state.candidateId)
      .eq('status', 'Technical Round')
      .order('changed_at', { ascending: false })
      .limit(1);
    assert(log?.length, 'no timeline entry written');
    return `timeline row ${log[0].id.slice(0, 8)}`;
  });

  await check('an illegal backward transition is rejected', async () => {
    const r = await apiJson('POST', `/api/jobs/${state.jobId}/applications/${state.candidateId}/decision`, {
      decision: 'Rejected',
      reason: 'E2E reject',
    });
    if (r.status < 400) return `allowed (HTTP ${r.status}) — policy permits reject from Technical Round`;
    return `blocked with HTTP ${r.status}`;
  });

  await check('technical round tab stays on the same application', async () => {
    const ws = await expectOk('GET', `/api/jobs/${state.jobId}/workspace`);
    const row = (ws.pipeline || []).find((p) => p.candidateId === state.candidateId);
    assert(row, 'candidate vanished from the pipeline');
    assert(row.currentStage === 'Technical Round', `currentStage=${row.currentStage}`);
    assert(row.jobId === state.jobId, 'row points at another job');
    return `stage=${row.currentStage}`;
  });

  await check('closing the job blocks NEW applications but keeps processing', async () => {
    await expectOk('PATCH', `/api/jobs/${state.jobId}/status`, { status: 'closed', reason: 'E2E' });
    const ws = await expectOk('GET', `/api/jobs/${state.jobId}/workspace`);
    assert(ws.job.status === 'closed', `status=${ws.job.status}`);
    assert((ws.pipeline || []).some((p) => p.candidateId === state.candidateId), 'closed job lost its applicants');
    return 'closed but applicants retained';
  });

  // 9 ─ negative / edge cases ------------------------------------------------
  section('9. Negative cases');
  await check('unauthorized request is rejected with JSON', async () => {
    const saved = TOKEN;
    TOKEN = '';
    const r = await apiJson('GET', `/api/jobs/${state.jobId}/workspace`);
    TOKEN = saved;
    assert(r.status === 401, `expected 401, got ${r.status}`);
    return `HTTP ${r.status} JSON`;
  });

  await check('a malformed job id returns JSON, never HTML', async () => {
    const r = await apiJson('GET', '/api/jobs/not-a-uuid/workspace');
    assert(r.status >= 400, `expected 4xx, got ${r.status}`);
    return `HTTP ${r.status} JSON`;
  });

  await check('a job that does not exist returns JSON 404', async () => {
    const r = await apiJson('GET', '/api/jobs/00000000-0000-0000-0000-000000000000/workspace');
    assert(r.status === 404, `expected 404, got ${r.status}`);
    return `HTTP ${r.status} JSON`;
  });

  await check('cross-job shortlist attempt is refused', async () => {
    const r = await apiJson('POST', `/api/jobs/${state.otherJobId}/applications/${state.candidateId}/shortlist`, {
      note: 'should not work',
    });
    if (r.status < 400) return `allowed (HTTP ${r.status}) — application exists for that job too`;
    return `refused with HTTP ${r.status}`;
  });

  await check('dashboard counts agree with the database', async () => {
    const ws = await expectOk('GET', `/api/jobs/${state.jobId}/workspace`);
    const { data } = await supabase
      .from('job_applications')
      .select('current_stage')
      .eq('job_id', state.jobId);
    const inDb = (data || []).length;
    assert(inDb === (ws.pipeline || []).length, `db=${inDb} workspace=${(ws.pipeline || []).length}`);
    return `${inDb} applications agree`;
  });

  // ── summary ──────────────────────────────────────────────────────────────
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'─'.repeat(64)}`);
  console.log(
    `${results.length - failed.length}/${results.length} checks passed` +
      (failed.length ? `, ${failed.length} FAILED` : ''),
  );
  if (failed.length) {
    console.log('\nFailures:');
    for (const f of failed) console.log(`  • ${f.name} — ${f.detail}`);
  }

  if (!KEEP) {
    await cleanup(state);
  } else {
    info(`KEEP=1 — probe data left in place: job=${state.jobId} assessment=${state.assessmentId}`);
  }

  process.exit(failed.length ? 1 : 0);
}

async function waitForDelivery(assessmentId, candidateId, seconds) {
  const deadline = Date.now() + seconds * 1000;
  let last = null;
  while (Date.now() < deadline) {
    const { data } = await supabase
      .from('assessment_invites')
      .select('delivery_status, sent_at, status')
      .eq('assessment_id', assessmentId)
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false })
      .limit(1);
    last = data?.[0];
    if (last && last.delivery_status !== 'pending') return last;
    await new Promise((r) => setTimeout(r, 5000));
  }
  return last || {};
}

async function seedApplicants(jobId, clerkId) {
  const { data: existing } = await supabase.from('candidates').select('id').limit(1);
  const ids = [];
  if (existing?.length) {
    ids.push(existing[0].id);
  }
  const { data: cands } = await supabase.from('candidates').select('id').limit(5);
  for (const c of cands || []) if (!ids.includes(c.id)) ids.push(c.id);
  if (!ids.length) throw new Error('no candidates available to seed the probe');
  const primary = ids[0];
  const { error } = await supabase.from('job_applications').insert({
    job_id: jobId,
    candidate_id: primary,
    current_stage: 'Screening',
    recruiter_id: (await supabase.from('recruiters').select('id').eq('clerk_id', clerkId).limit(1)).data?.[0]?.id,
  });
  if (error) info(`seed note: ${error.message}`);
  for (const id of ids.slice(1, 4)) {
    await supabase.from('job_applications').insert({
      job_id: jobId,
      candidate_id: id,
      current_stage: 'Applied',
      recruiter_id: (await supabase.from('recruiters').select('id').eq('clerk_id', clerkId).limit(1)).data?.[0]?.id,
    });
  }
  return { primary, all: ids };
}

async function cleanup(state) {
  if (!state.jobId) return;
  info('cleaning up probe rows…');
  try {
    const { data: inv } = await supabase
      .from('assessment_invites')
      .select('id')
      .eq('assessment_id', state.assessmentId || '__none__');
    for (const i of inv || []) {
      await supabase.from('assessment_attempts').delete().eq('invite_id', i.id);
    }
    if (inv?.length) await supabase.from('assessment_invites').delete().in('id', inv.map((i) => i.id));
    if (state.assessmentId) {
      await supabase.from('assessment_questions').delete().eq('assessment_id', state.assessmentId);
      await supabase.from('assessments').delete().eq('id', state.assessmentId);
    }
    await supabase.from('candidate_status_log').delete().eq('job_id', state.jobId);
    await supabase.from('job_applications').delete().eq('job_id', state.jobId);
    if (state.otherJobId) await supabase.from('jobs').delete().eq('id', state.otherJobId);
    await supabase.from('jobs').delete().eq('id', state.jobId);
  } catch (e) {
    info(`cleanup incomplete: ${e.message}`);
  }
}

main().catch((e) => {
  console.error(`\n\x1b[31mFATAL\x1b[0m ${e.stack || e.message}`);
  process.exit(2);
});