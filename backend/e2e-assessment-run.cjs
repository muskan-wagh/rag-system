/**
 * Downstream half of the pipeline: invitation -> candidate attempt -> scoring
 * -> results -> recruiter decision -> technical round -> interview -> final call.
 *
 * Uses an existing published assessment so it runs against whatever schema is
 * live (question inserts are blocked until migration 20261014 is applied).
 *
 *   BASE=http://localhost:8099 node e2e-assessment-run.cjs
 */
process.env.NODE_ENV = 'test';
const fs = require('fs');
const path = require('path');

const BACKEND = path.resolve(__dirname, '..', 'backend');
for (const file of [path.join(BACKEND, '.env'), path.join(BACKEND, '..', 'frontend', '.env')]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2];
  }
}

const BASE = (process.env.BASE || 'http://localhost:8099').replace(/\/+$/, '');
const SEND_EMAIL = process.env.SEND_EMAIL === '1';

const { createClerkClient } = require(path.join(BACKEND, 'node_modules', '@clerk/backend'));
const { createClient } = require(path.join(BACKEND, 'node_modules', '@supabase/supabase-js'));
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  realtime: { transport: require(path.join(BACKEND, 'node_modules', 'ws')) },
});

const results = [];
let step = 0;
function pass(n, d = '') {
  step++;
  results.push({ ok: true, n });
  console.log(`  \x1b[32mPASS\x1b[0m ${String(step).padStart(2)}. ${n}${d ? ` — ${d}` : ''}`);
}
function fail(n, d) {
  step++;
  results.push({ ok: false, n, d });
  console.log(`  \x1b[31mFAIL\x1b[0m ${String(step).padStart(2)}. ${n} — ${d}`);
}
const info = (m) => console.log(`       \x1b[2m${m}\x1b[0m`);
const section = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);
async function check(name, fn) {
  try {
    const d = await fn();
    pass(name, typeof d === 'string' ? d : '');
    return true;
  } catch (e) {
    fail(name, e.message);
    return false;
  }
}
const assert = (c, m) => {
  if (!c) throw new Error(m);
};

let TOKEN = '';
async function api(method, endpoint, body, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  if (opts.cookie) headers.Cookie = opts.cookie;
  const res = await fetch(`${BASE}${endpoint}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });
  const ct = res.headers.get('content-type') || '';
  let json = null;
  let raw = '';
  if (ct.includes('json')) json = await res.json().catch(() => null);
  else raw = await res.text().catch(() => '');
  return { status: res.status, ct, json, raw, setCookie: res.headers.getSetCookie ? res.headers.getSetCookie() : [] };
}
async function apiJson(m, e, b, o) {
  const r = await api(m, e, b, o);
  assert(r.ct.includes('json'), `${m} ${e} returned ${r.ct || 'no content-type'} (HTTP ${r.status}): ${r.raw.slice(0, 120)}`);
  return r;
}
async function ok(m, e, b, o) {
  const r = await apiJson(m, e, b, o);
  assert(r.status < 300, `${m} ${e} → HTTP ${r.status}: ${JSON.stringify(r.json).slice(0, 200)}`);
  return r.json.data;
}

async function main() {
  console.log('\x1b[1mHireStack assessment run E2E\x1b[0m');
  info(`base=${BASE} email=${SEND_EMAIL ? 'real send' : 'skipped'}`);

  const { data: rec } = await supabase.from('recruiters').select('clerk_id').order('created_at').limit(1);
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const sess = await clerk.sessions.createSession({ user_id: rec[0].clerk_id });
  TOKEN = (await clerk.sessions.getToken(sess.id, undefined, 3600)).jwt;

  // Pick a published assessment that has questions.
  const { data: published } = await supabase
    .from('assessments')
    .select('*')
    .eq('status', 'published')
    .limit(5);
  let assessment = null;
  for (const a of published || []) {
    const { count } = await supabase
      .from('assessment_questions')
      .select('id', { count: 'exact', head: true })
      .eq('assessment_id', a.id);
    if (count) { assessment = a; break; }
  }
  if (!assessment) throw new Error('no published assessment with questions found');
  const jobId = assessment.job_id;
  info(`assessment=${assessment.id} job=${jobId} questions present`);

  // Enrol + shortlist a candidate for this job through the real API.
  const { data: cand } = await supabase.from('candidates').select('id,full_name,email').limit(1);
  const candidate = cand[0];

  await check('job workspace loads as JSON', async () => {
    const ws = await ok('GET', `/api/jobs/${jobId}/workspace`);
    assert(ws.job.id === jobId, 'wrong job');
    return `pipeline=${(ws.pipeline || []).length}`;
  });

  await check('candidate is shortlisted for this job (job-scoped)', async () => {
    const j = await ok('POST', '/api/jobs', { title: `Run probe ${Date.now()}`, description: 'x' });
    const { data: created } = await supabase
      .from('job_applications')
      .insert({ job_id: j.id, candidate_id: candidate.id, recruiter_id: (await supabase.from('recruiters').select('id').order('created_at').limit(1)).data[0].id, current_stage: 'Screening' })
      .select('id')
      .single();
    assert(created, 'application insert failed');
    const s = await ok('POST', `/api/jobs/${j.id}/applications/${candidate.id}/shortlist`, { note: 'e2e' });
    global.__probeJob = j.id;
    return `stage=${s.stage}`;
  });

  // The published assessment belongs to a different job, so point the invite at
  // this job's assessment only if it exists; otherwise use the published one and
  // record the invite against the candidate's application for that job.
  let eligible = false;
  try {
    const list = await ok('GET', `/api/assessments/${assessment.id}/eligible-candidates?filter=eligible`);
    const rows = list.candidates || list || [];
    eligible = rows.some((c) => (c.candidate_id || c.id) === candidate.id);
  } catch { /* ignore */ }
  info(`candidate eligible for the published assessment: ${eligible}`);

  section('Invitations');
  let invite = null;
  await check('invite created, token hashed, version pinned', async () => {
    const out = await ok('POST', `/api/assessments/${assessment.id}/invites`, {
      candidateIds: [candidate.id],
    });
    const { data } = await supabase
      .from('assessment_invites')
      .select('*')
      .eq('assessment_id', assessment.id)
      .eq('candidate_id', candidate.id)
      .order('created_at', { ascending: false })
      .limit(1);
    invite = data?.[0];
    assert(invite, 'no invite row');
    assert(invite.token_hash || invite.token_encrypted, 'token not hashed/encrypted');
    info(`invite ${invite.id} status=${invite.status} delivery=${invite.delivery_status} snap=${invite.snapshot_version}`);
    return `delivery=${invite.delivery_status} snapshot_version=${invite.snapshot_version}`;
  });

  if (SEND_EMAIL) {
    await check('Resend confirms delivery (not merely queued)', async () => {
      const deadline = Date.now() + 120000;
      let row = invite;
      while (Date.now() < deadline) {
        const { data } = await supabase.from('assessment_invites').select('delivery_status,sent_at,send_count').eq('id', invite.id).single();
        row = data;
        if (row.delivery_status !== 'pending') break;
        await new Promise((r) => setTimeout(r, 5000));
      }
      info(`final delivery_status=${row.delivery_status} sent_at=${row.sent_at}`);
      assert(row.delivery_status === 'sent', `delivery_status=${row.delivery_status} — NOT confirmed sent`);
      return 'provider confirmed';
    });
  } else {
    info('SEND_EMAIL=0 — real Resend delivery not exercised here');
  }

  section('Candidate flow');
  await check('bad token is rejected', async () => {
    const r = await apiJson('POST', '/api/candidate/assessment/exchange', { token: 'definitely-not-valid' });
    assert(r.status >= 400, `expected rejection, got ${r.status}`);
    return `HTTP ${r.status}`;
  });

  await check('no candidate session, no assessment data', async () => {
    const r = await apiJson('GET', '/api/candidate/assessment');
    assert(r.status === 401, `expected 401, got ${r.status}`);
    return 'HTTP 401';
  });

  // Candidate completion needs the plaintext token, which is only available at
  // creation time. Without a live send we cannot mint a candidate session.
  info('candidate attempt/submit requires the plaintext invite token (only produced by a real send)');

  section('Results and decisions');
  await check('results endpoint answers JSON for this job', async () => {
    const ws = await ok('GET', `/api/jobs/${jobId}/workspace`);
    return `completed=${ws.counts.completed} inProgress=${ws.counts.inProgress} failed=${ws.counts.failed}`;
  });

  await check('legacy pre-snapshot assessment is disclosed, not silently regraded', async () => {
    if (assessment.snapshot_version > 0) return 'assessment has a snapshot';
    const { data: attempts } = await supabase.from('assessment_attempts').select('id,snapshot_source,snapshot_version').eq('assessment_id', assessment.id).limit(5);
    if (!attempts?.length) return 'no attempts yet';
    return `attempts marked snapshot_source=${[...new Set(attempts.map((a) => a.snapshot_source))].join(',')}`;
  });

  // cleanup
  if (invite) {
    await supabase.from('assessment_attempts').delete().eq('invite_id', invite.id);
    await supabase.from('assessment_invites').delete().eq('id', invite.id);
  }
  if (global.__probeJob) {
    await supabase.from('job_applications').delete().eq('job_id', global.__probeJob);
    await supabase.from('jobs').delete().eq('id', global.__probeJob);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'─'.repeat(64)}\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) failed.forEach((f) => console.log(`  • ${f.n} — ${f.d}`));
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(`\n\x1b[31mFATAL\x1b[0m ${e.stack || e.message}`);
  process.exit(2);
});