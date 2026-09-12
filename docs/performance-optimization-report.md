# HireStack Performance & Architecture Report

Staging evaluation of the HireStack RAG recruitment system: 5-resume concurrent processing simulation, API idle-vs-busy comparison, reliability checks, and embedding-compatibility investigation. All numbers below are measured values from the staging runs on 2026-09-12. Anything not measured is labeled **Not measured** — no figures are invented or extrapolated.

## Executive Summary

HireStack is a RAG pipeline (Next.js → Express API → BullMQ/Redis worker → PDF parsing → OpenRouter LLM → MiniLM embeddings → Qdrant → Supabase) that was showing three pressure points: a slow dashboard, ONNX embedding overhead on the API event loop, and worker resource risk under concurrent resume processing.

Optimizations were implemented across the dashboard (deduplicated fetching, smaller payloads, working Redis cache, calmer polling), the worker (lock duration, timeouts, duplicate-job suppression, fail-fast invalid resumes, buffer release, observability), embeddings (single-flight model loading, LRU cache, stored-vector reuse), and error handling (truncated error propagation, isolated recovery).

**Worker concurrency remains exactly 5.** The existing Qdrant collection (384 dimensions, Cosine, 11 points) was not modified, no production candidates were re-embedded, no production data was written during testing, and production remains on local MiniLM embeddings.

**Actual test result:** 5/5 simulated resume jobs completed concurrently with 0 failures, 0 retries, and stable memory; the API stayed responsive throughout; candidate search and ranking behave correctly over the existing collection; hosted alternatives (Hugging Face serverless, Cloudflare BGE) were proven incompatible, so local MiniLM stands.

## Architecture

```
Vercel (Next.js frontend)
  ↓ HTTPS
Render API (Express, Clerk auth, rate limiting)
  ↓ enqueue                    ↓ reads
Redis / BullMQ  ←→  Supabase (Postgres + Storage)
  ↓ resume-processing queue
Worker (concurrency = 5, separate process)
  ↓                    ↓                    ↓
Resume Parser → OpenRouter LLM → MiniLM embeddings (384-d)
                                       ↓ upsert / search
                              Qdrant (384-d, Cosine)
```

- **Vercel / Next.js 16:** marketing pages (public) plus the authenticated app (dashboard, candidates, search, compare, pools, interviews, history, settings).
- **Render API (Express):** Clerk-authenticated REST API with Redis rate limiting; serves dashboard, search, candidates, interviews, offers, uploads.
- **Redis / BullMQ:** `resume-processing` queue (attempts 3, exponential 5s backoff, retain 100 complete / 50 failed) plus an `email-sending` queue and the dashboard/search caches.
- **Worker × 5:** separate forked process (`start-all.js` forks API and worker independently, so worker CPU cannot block Express). Pipeline per job: mark PROCESSING → download from Supabase Storage → PDF/DOCX text extraction → Qwen LLM parse → flight-risk rules → MiniLM embedding → Supabase update + skills/experience inserts → Qdrant upsert → completion event.
- **Resume parser:** `pdf-parse` v2 for PDFs, `mammoth` for DOCX, 5MB limit enforced at upload (multer + Zod) and re-checked in the parser.
- **OpenRouter:** Qwen models for resume parsing, JD parsing, bias scan, comparison, screening questions, email templates; 45s timeout with capped retries.
- **MiniLM embeddings:** `Xenova/all-MiniLM-L6-v2` (quantized ONNX, 384-d, mean pooling, L2-normalized), one singleton per process with single-flight loading and a bounded LRU cache (200 entries, 1h TTL).
- **Qdrant:** `candidates` collection, 384 dimensions, Cosine distance, 11 points at evaluation time. Stores one vector per candidate plus a searchable payload (name, skills, experience, education).
- **Supabase:** Postgres (candidates, sessions, skills, interviews, offers, notes, status log, activity, pools, history) plus the `resumes` storage bucket.

## Original Bottlenecks (all verified in code, then measured where possible)

1. **Dashboard fetched twice per visit** — the page (`limit=50`) and the notifications menu (`limit=20`) used different SWR keys, producing two heavy backend requests.
2. **Dashboard overfetch** — 50 candidates + 50 sessions fetched while the UI renders 5.
3. **Dead Redis cache on the API** — the client was created with `lazyConnect: true` but never connected at boot, so every dashboard request hit the database (~10–11 Supabase round trips in two sequential waves).
4. **Aggressive revalidation** — 30s polling plus an unthrottled WebSocket `mutate()` on every status event.
5. **Blocking first paint** — a full-screen spinner gated the entire dashboard on the slowest backend section.
6. **ONNX on the API event loop** — candidate-brief and similar-candidates recomputed embeddings per request; search embeddings also run in-process.
7. **BullMQ lock default (30s) shorter than real job duration** (30–120s with two 45s-timeout LLM calls) — live jobs risked being marked stalled and processed twice.
8. **No duplicate-job protection** — double submits processed the same resume twice; no processor timeout, so one hung LLM call could pin 1 of 5 slots.
9. **Wasted work and retention** — corrupt resumes retried 3× through the LLM; full file buffers held through all 8 worker steps; empty `.in([])` dashboard queries failed against Supabase.

## Optimizations (implemented; worker concurrency unchanged at 5)

| # | Problem → Solution → Impact → Status |
|---|---|
| 1 | Duplicate dashboard fetch → shared SWR key/size (`DASHBOARD_PAGE_SIZE = 8`, memoized API client) → 2 heavy requests become 1 → **PASS** (code-verified; HTTP-level re-measurement needs an authed session) |
| 2 | Overfetch 50 → limit 8 on page, API client, and backend default → −84% candidate/session rows per load → **PASS** (code-verified) |
| 3 | Dead Redis cache → `ensureRedisConnected()` at API boot → cache hits in ~40ms vs 1–3s DB path → **PASS** (verified live in a prior round; this round's boot log confirms `Redis ready (api-server)`) |
| 4 | 60s dashboard TTL → 5min + 10min stale-while-revalidate; invalidation kept on all mutation paths → 5× hit window → **PASS** (code-verified) |
| 5 | 30s poll + unthrottled WS refetch → 120s poll, 2s debounce, 30s WS throttle, hidden-tab skip → −75% polling, no reload storms → **PASS** (code-verified) |
| 6 | Full-screen loader → section skeletons, duplicate link card removed, reduced motion → interactive first paint → **PASS** (code-verified; render timing Not measured — needs a browser) |
| 7 | ONNX per-request in brief/similar → `retrieveCandidateVector()` reuses the stored Qdrant vector, fallback only when missing → 2 inferences eliminated per request → **PASS** (verified live: identical bytes, 168ms, null-fallback path) |
| 8 | Cold-start model stampede → single-flight loader → at most one model instance per process under concurrency 5 → **PASS** (code-verified; 5-job run loaded once, RSS +199MB total) |
| 9 | Repeated texts recompute → bounded LRU embedding cache (200 entries/1h) → repeat embedding 0ms → **PASS** (measured: second identical call 0ms) |
| 10 | 30s BullMQ lock → `lockDuration: 180s`, `stalledInterval: 60s` → no more stall-duplicates on 30–120s jobs → **PASS** (code-verified; live stall test Not measured — needs minutes-long jobs on isolated Redis) |
| 11 | Hung jobs pin slots → 300s processor timeout (fails into normal retry) → **PASS** (code-verified; live timeout Not measured for the same reason) |
| 12 | Double-submit duplicates → stable `resume-<candidateId>` job IDs with duplicate suppression in upload + recovery → one live job per candidate → **PASS** (verified live in a prior round: concurrent enqueues produced a single job record; re-verified statically this round) |
| 13 | Corrupt resumes waste 3 LLM retries → `UnrecoverableError` fail-fast (still marks FAILED, never dropped) → **PASS** (code-verified; corrupt-parse graceful 400 verified live) |
| 14 | Buffer retention → file buffer released after extraction; oversized storage downloads rejected → lower per-job peak RAM → **PASS** (code-verified) |
| 15 | Empty `.in([])` dashboard queries → skipped when ID lists are empty → fewer wasted round trips for new recruiters → **PASS** (code-verified) |
| 16 | Unbounded error text to DB/WebSocket clients → truncated to 300 chars; per-candidate recovery isolation → **PASS** (code-verified) |
| 17 | No worker observability → per-job duration + heap/RSS logging → **PASS** (log lines present; sample in Resume Processing) |

## Performance Results (measured 2026-09-12, local staging, real services for Qdrant/Redis/Supabase reads)

Test topology note: the API server and the 5-job harness ran as **separate processes** (mirroring production's forked API/worker split). No production data was written: Qdrant/Supabase access was read-only; LLM stages were not executed live (prod key/cost); resume parsing used 5 synthetic PDFs (751B–12.5KB).

| Metric | Worker Idle | 5 Jobs Running | Result |
|---|---:|---:|---|
| `GET /` (5 samples) | 200 in 2–7ms (106ms first/JIT) | 200 in 3–7ms | No degradation observed |
| `GET /health` (5 samples) | 200 in 0.39–0.97s | 200 in 0.49–1.04s | No degradation observed (one sample overlapped active inference) |
| Candidate search (embed→Qdrant→rank) | 384-d in 737ms; 10 hits in 1027ms; ranked top 0.490 | Not measured separately | Baseline recorded |
| Dashboard TTFB | Not measured (needs Clerk session) | Not measured | — |
| Dashboard Load | Not measured (needs browser) | Not measured | — |
| Worker RSS | 82–84MB pre-model | peak 281MB (cold) / 272MB (warm) | +~200MB model, then flat |
| Worker Heap | 13MB pre-model | peak 31–35MB, stable | No growth across 5 jobs |

Authed endpoints (`/api/candidates`, `/api/candidates/search`, `/api/dashboard`) were **Not measured** over HTTP — no Clerk test token exists in this environment. Their underlying service path (embed → Qdrant → rank) was measured directly as shown above.

## Resume Processing (5 synthetic resumes, concurrency 5, cold model)

| Job | Duration | Parse | Embed | Qdrant | Rank | RSS | Heap | Retries | Status |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| backend | 11,839ms | 3,765ms | 6,567ms | 1,505ms | 1ms | 281MB | 31MB | 0 | ok |
| frontend | 11,838ms | 3,938ms | 6,620ms | 1,278ms | 1ms | 281MB | 31MB | 0 | ok |
| data (12.5KB) | 11,814ms | 3,951ms | 6,608ms | 1,240ms | 9ms | 280MB | 30MB | 0 | ok |
| nurse | 11,828ms | 3,938ms | 6,621ms | 1,267ms | 1ms | 281MB | 31MB | 0 | ok |
| marketing | 11,821ms | 3,938ms | 6,622ms | 1,254ms | 1ms | 280MB | 31MB | 0 | ok |

Wall time 11,852ms with `maxActive = 5` (all five jobs provably overlapping); CPU user 3.25s / sys 1.03s; 5 successful, 0 failed, 0 retries, 0 duplicates, 0 timeouts, 0 stalled. A warm repeat finished in 2,296ms wall (model + weights cached), 5/5 ok. First-call parse cost (~3.9s) includes pdf-parse/pdfjs init; per-call inference afterwards is tens of ms. Under 5-way concurrency, per-call embedding latency rose (~6.6s vs ~1s solo) — expected ONNX CPU contention, not a defect.

## Reliability

- **Duplicate job test:** PASS — concurrent enqueues for one candidate yield a single live BullMQ job record (measured live in a prior round against Redis with test IDs, cleaned up afterwards); stable `resume-<candidateId>` IDs verified in upload and recovery paths this round. Uploads are never dropped (202 + candidate id regardless).
- **Retry test:** PASS (configuration) — attempts 3, exponential 5s backoff, retain 100 complete / 50 failed, verified in built output. Live end-to-end retry against an isolated broker was Not measured (no local Redis; shared Redis is off-limits).
- **Timeout test:** code-verified (300s `Promise.race` wrapper feeds the normal fail→retry path). Live timeout Not measured (requires a hung job on isolated infra).
- **Corrupt resume test:** PASS (live) — garbage PDF bytes produce a 400 `AppError`, process stays alive; oversized buffers rejected before parsing.
- **Worker stability:** 5/5 jobs ok across two runs; heap flat (13→31→35MB); no evidence of per-job retention. A no-leak claim would need soak testing — **not claimed**.

## Retrieval / Ranking

Pipeline: JD text → MiniLM embedding (384-d) → Qdrant cosine top-K → skill (30%) + experience (20%) + education (15%) + semantic (35%) blended rank.

Measured over the existing 11-candidate collection (IDs truncated, no PII recorded):

| JD | Top result (sem / overall / skill overlap) | Behavior |
|---|---|---|
| Backend Node | `81b564d9` 0.422 / 0.46, top-5 all JS/Node | Correct cluster |
| Frontend React | `81b564d9` 0.285 / 0.60, top-5 all JS | Correct cluster (skill blend decides) |
| Python/data | `5f07796a` 0.618 / 0.65, 4/4 skills | Ideal hit |
| Product | PM profile 0.48 / 0.56, all 4 PMs top-4 | Ideal cluster |
| Full-stack | JS profile top; PM-hybrid profiles close behind (sem ~0.30 flat) | Reasonable on a tiny collection; semantic signal is weak when scores cluster |
| Unknown skill (ICU nurse) | top sem 0.151, all overlaps ~0 | Graceful degradation, no false confidence |

Formal retrieval accuracy was not measured because no labeled evaluation dataset was available.

## Embedding Compatibility (PASS = investigation complete, decision: local)

- **Local MiniLM-L6-v2:** 384-d, matches collection → **PASS, current production.**
- **Hugging Face serverless MiniLM:** the router maps this repo to a sentence-similarity pipeline — raw vectors unavailable at any key (measured HTTP 400). → **FAIL (endpoint limitation, not a code bug).** A dedicated HF Inference Endpoint would work with the already-implemented env-configured provider, but is undeployed/unvalidated.
- **Cloudflare BGE-small (only 384-d model in their catalog):** same dimension, different weights. Measured cross-model cosine **0.19–0.38 (avg 0.30)** over 10 texts and Qdrant top-5 overlap of **1–2/5** — near-random. → **FAIL (different vector space).** Adopting it would require a new collection plus full re-embed; rejected.
- **Hosted same-weight MiniLM:** NOT TESTED (no endpoint exists yet) — the only safe future hosted path.

## Before vs After

**Measured improvements (this evaluation):** stored-vector reuse serves identical bytes in 168ms with zero inference; embedding cache repeat calls return in 0ms; 5-way concurrent processing completes with flat memory; API public endpoints show no degradation under load.

**Code-level improvements (verified by inspection + build, HTTP re-measurement needs an authed session):** single-request dashboard fetching (−84% rows), working 5-minute Redis cache, 120s/visibility-gated revalidation, progressive skeletons, BullMQ lock/timeout/dedupe/fail-fast safeguards, parser size guards, buffer release, error truncation, empty-query guards, worker observability.

**Not yet measured:** authed-endpoint latency deltas, dashboard render timing, live retry/timeout/stalled behavior, Qdrant upsert path (writes forbidden on the shared collection), LLM stage durations, multi-hour memory soak.

## Remaining Bottlenecks (verified only)

1. Novel-JD search still runs ONNX on the API event loop (mitigated by cache + vector reuse elsewhere).
2. First model load downloads ~23MB + ~200MB RSS per process (one-time; then flat).
3. No isolated staging infrastructure (shared Redis/Supabase/Qdrant constrain live failure testing).
4. Dashboard authenticated-path timing still unmeasured.

## Future Work (not implemented)

Hosted same-weight MiniLM behind `EMBEDDING_PROVIDER=hosted` after staging gates pass; dedicated worker infrastructure; dashboard query consolidation and deferred widgets; Redis-backed embedding cache shared across processes; real monitoring (P95s, error budgets); a labeled retrieval evaluation dataset for formal accuracy.

---

*Evaluation: staging harness (offline) + live read-only service calls, 2026-09-12. Worker concurrency 5 throughout. Qdrant collection unmodified (11 points before and after). No production writes. No secrets in this report.*
