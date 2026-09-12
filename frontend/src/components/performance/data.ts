export type Verdict = "PASS" | "FAIL" | "NOT TESTED";

export const EVAL_DATE = "2026-09-12";

export const ARCH_NODES = [
  { name: "Vercel", desc: "Next.js 16 frontend" },
  { name: "Render API", desc: "Express · Clerk auth · rate limits" },
  { name: "Redis / BullMQ", desc: "queues + caches" },
  { name: "Worker × 5", desc: "separate process" },
  { name: "Parser → LLM", desc: "pdf-parse · Qwen" },
  { name: "MiniLM 384-d", desc: "local embeddings" },
  { name: "Qdrant", desc: "384-d · Cosine · 11 pts" },
  { name: "Supabase", desc: "Postgres + Storage" },
] as const;

export const PIPELINE = [
  "Upload",
  "Queue",
  "Worker ×5",
  "PDF parsing",
  "LLM extraction",
  "Embedding",
  "Qdrant",
  "Ranking",
] as const;

export const BOTTLENECKS = [
  { title: "Dashboard fetched twice", detail: "Page (limit 50) + notifications menu (limit 20) used different cache keys — two heavy backend requests per visit." },
  { title: "Dashboard overfetch", detail: "50 candidates + 50 sessions fetched while the UI renders 5." },
  { title: "Dead Redis cache", detail: "lazyConnect client never connected at boot — every dashboard load hit ~10 Supabase round trips." },
  { title: "Reload storms", detail: "30s polling plus unthrottled WebSocket revalidation on every status event." },
  { title: "Blocking first paint", detail: "Full-screen spinner gated the dashboard on its slowest section." },
  { title: "ONNX on the API loop", detail: "Brief + similar-candidates recomputed embeddings per request." },
  { title: "30s BullMQ lock", detail: "Shorter than real 30–120s jobs — live jobs risked stall-duplicates." },
  { title: "No duplicate protection", detail: "Double submits processed the same resume twice; hung jobs could pin a slot." },
  { title: "Wasted retries", detail: "Corrupt resumes burned 3 LLM retries; buffers held through all 8 steps." },
] as const;

export interface Optimization {
  problem: string;
  solution: string;
  impact: string;
  status: Verdict;
}

export const OPTIMIZATIONS: Optimization[] = [
  { problem: "Duplicate dashboard fetch", solution: "Shared SWR key + size 8, memoized client", impact: "2 heavy requests → 1", status: "PASS" },
  { problem: "50-row overfetch", solution: "Limit 8 on page, client, backend default", impact: "−84% rows per load", status: "PASS" },
  { problem: "Dead Redis cache", solution: "connect() at API boot", impact: "~40ms hits vs 1–3s DB path", status: "PASS" },
  { problem: "60s cache TTL", solution: "5min + 10min stale-while-revalidate", impact: "5× hit window", status: "PASS" },
  { problem: "30s poll + WS storms", solution: "120s poll, debounced + throttled WS", impact: "−75% polling", status: "PASS" },
  { problem: "Blocking spinner", solution: "Section skeletons, less motion", impact: "Interactive first paint", status: "PASS" },
  { problem: "Per-request ONNX in brief/similar", solution: "Reuse stored Qdrant vector", impact: "2 inferences eliminated/request", status: "PASS" },
  { problem: "Cold-start model stampede", solution: "Single-flight loader", impact: "≤1 model instance/process", status: "PASS" },
  { problem: "Repeated texts recompute", solution: "Bounded LRU cache (200/hr)", impact: "Repeat calls 0ms", status: "PASS" },
  { problem: "30s BullMQ lock", solution: "lockDuration 180s + stalledInterval 60s", impact: "No stall-duplicates", status: "PASS" },
  { problem: "Hung jobs pin slots", solution: "300s processor timeout", impact: "Fails into normal retry", status: "PASS" },
  { problem: "Double-submit duplicates", solution: "Stable per-candidate job IDs", impact: "One live job/candidate", status: "PASS" },
  { problem: "Corrupt resumes waste LLM", solution: "Fail-fast without retries", impact: "No wasted calls, still marked FAILED", status: "PASS" },
  { problem: "Buffer retention", solution: "Release after extraction + size guard", impact: "Lower per-job peak RAM", status: "PASS" },
];

export const RELIABILITY: { name: string; status: Verdict; detail: string }[] = [
  { name: "Concurrency = 5", status: "PASS", detail: "maxActive 5 measured; config unchanged" },
  { name: "Lock duration 180s", status: "PASS", detail: "Verified in built output" },
  { name: "Processor timeout 300s", status: "PASS", detail: "Verified in built output" },
  { name: "Retries 3 + exp backoff", status: "PASS", detail: "Verified in built output" },
  { name: "Duplicate prevention", status: "PASS", detail: "Single job record measured; IDs in upload + recovery" },
  { name: "Corrupt resume handling", status: "PASS", detail: "400 AppError, process alive" },
  { name: "Live retry/timeout E2E", status: "NOT TESTED", detail: "No isolated broker available" },
];

export const PERF_TABLE: { metric: string; idle: string; busy: string; result: string }[] = [
  { metric: "GET /", idle: "200 · 2–7ms", busy: "200 · 3–7ms", result: "No degradation" },
  { metric: "GET /health", idle: "200 · 0.39–0.97s", busy: "200 · 0.49–1.04s", result: "No degradation" },
  { metric: "Candidate search", idle: "737ms embed · 1027ms Qdrant", busy: "Not measured separately", result: "Baseline recorded" },
  { metric: "Dashboard TTFB", idle: "Not measured", busy: "Not measured", result: "Needs authed session" },
  { metric: "Dashboard load", idle: "Not measured", busy: "Not measured", result: "Needs browser" },
  { metric: "Worker RSS", idle: "82–84MB", busy: "Peak 281MB", result: "+~200MB model, then flat" },
  { metric: "Worker heap", idle: "13MB", busy: "Peak 31–35MB", result: "Stable" },
];

export const JOB_ROWS = [
  { job: "backend", duration: "11,839ms", rss: "281MB", heap: "31MB", retries: "0", status: "ok" },
  { job: "frontend", duration: "11,838ms", rss: "281MB", heap: "31MB", retries: "0", status: "ok" },
  { job: "data (12.5KB)", duration: "11,814ms", rss: "280MB", heap: "30MB", retries: "0", status: "ok" },
  { job: "nurse", duration: "11,828ms", rss: "281MB", heap: "31MB", retries: "0", status: "ok" },
  { job: "marketing", duration: "11,821ms", rss: "280MB", heap: "31MB", retries: "0", status: "ok" },
] as const;

export const RETRIEVAL_ROWS = [
  { jd: "Backend Node", top: "81b564d9", sem: "0.422", overall: "0.46", note: "Correct cluster" },
  { jd: "Frontend React", top: "81b564d9", sem: "0.285", overall: "0.60", note: "Correct cluster" },
  { jd: "Python / data", top: "5f07796a", sem: "0.618", overall: "0.65", note: "Ideal hit" },
  { jd: "Product", top: "ad188329", sem: "0.480", overall: "0.56", note: "Ideal cluster" },
  { jd: "Full-stack", top: "4c8d0db5", sem: "0.302", overall: "0.57", note: "Reasonable, flat scores" },
  { jd: "Unknown skill", top: "5f07796a", sem: "0.124", overall: "0.30", note: "Graceful, low scores" },
] as const;

export const COMPAT_MATRIX: { service: string; status: Verdict; result: string }[] = [
  { service: "Local MiniLM", status: "PASS", result: "Current production · 384-d" },
  { service: "HF serverless MiniLM", status: "FAIL", result: "Router serves similarity pipeline, no raw vectors" },
  { service: "Cloudflare BGE", status: "FAIL", result: "384-d but cosine 0.30 · overlap 1–2/5" },
  { service: "Hosted same-weight MiniLM", status: "NOT TESTED", result: "Future option · needs endpoint" },
];

export const REMAINING = [
  "Novel-JD search still runs ONNX on the API event loop (cache + reuse mitigate it).",
  "First model load downloads ~23MB + ~200MB RSS per process (one-time, then flat).",
  "No isolated staging infrastructure — live failure testing is constrained.",
  "Dashboard authenticated-path timing still unmeasured (needs Clerk session + browser).",
] as const;
