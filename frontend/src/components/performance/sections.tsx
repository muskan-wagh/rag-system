"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import {
  ARCH_NODES,
  PIPELINE,
  BOTTLENECKS,
  OPTIMIZATIONS,
  RELIABILITY,
  PERF_TABLE,
  JOB_ROWS,
  RETRIEVAL_ROWS,
  COMPAT_MATRIX,
  REMAINING,
  EVAL_DATE,
  type Verdict,
} from "./data";

function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Section({
  id,
  index,
  title,
  lede,
  children,
}: {
  id: string;
  index: string;
  title: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="w-full py-12 md:py-16 scroll-mt-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Reveal>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {index}
          </p>
          <h2 className="mt-1 text-xl md:text-2xl font-semibold text-foreground">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground leading-relaxed">{lede}</p>
        </Reveal>
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}

function Badge({ status }: { status: Verdict }) {
  const cls =
    status === "PASS"
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : status === "FAIL"
        ? "bg-red-500/10 text-red-600 dark:text-red-400"
        : "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {status === "NOT TESTED" ? "NOT TESTED" : status}
    </span>
  );
}

function Table({
  head,
  children,
}: {
  head: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[640px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-border">
            {head.map((h) => (
              <th key={h} className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border text-foreground">{children}</tbody>
      </table>
    </div>
  );
}

export function PerformanceHero() {
  return (
    <section className="w-full pt-10 md:pt-14 pb-8">
      <div className="mx-auto max-w-6xl px-4 md:px-6 text-center">
        <Reveal>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Staging evaluation · {EVAL_DATE} · worker concurrency = 5
          </p>
          <h1 className="mx-auto mt-3 max-w-3xl text-3xl md:text-[40px] font-semibold leading-tight text-foreground">
            Performance & <span className="text-primary">Architecture</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm md:text-[15px] text-muted-foreground leading-relaxed">
            Measured numbers from a controlled 5-resume staging run — 5/5 jobs completed
            concurrently with flat memory, the API stayed responsive, and the Qdrant
            collection was never modified. Anything unmeasured is labeled as such.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-center">
            {[
              ["5/5", "jobs ok · 0 failed"],
              ["281MB", "peak RSS (model incl.)"],
              ["3–7ms", "API under load"],
              ["384-d", "vectors untouched"],
            ].map(([v, l]) => (
              <div key={l}>
                <p className="font-data text-2xl font-medium text-foreground">{v}</p>
                <p className="mt-1 text-xs text-muted-foreground">{l}</p>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <a
              href="#technical-report"
              className="inline-flex items-center justify-center rounded-[8px] bg-primary-solid px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-solid-hover transition-all duration-120"
            >
              Technical Report
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function ArchitectureSection() {
  return (
    <Section
      id="architecture"
      index="01 · System architecture"
      title="How HireStack fits together"
      lede="Requests flow top-down; heavy resume work runs in a separate worker process so the API stays responsive."
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {ARCH_NODES.map((n, i) => (
          <Reveal key={n.name}>
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="font-data text-[11px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</p>
              <p className="mt-1 text-sm font-medium text-foreground">{n.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{n.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

export function PipelineSection() {
  return (
    <Section
      id="pipeline"
      index="02 · Resume processing pipeline"
      title="From upload to ranked candidate"
      lede="Each job moves through eight steps; the staging run timed the CPU-heavy middle stages."
    >
      <Reveal>
        <ol className="flex flex-col gap-2 md:flex-row md:flex-wrap">
          {PIPELINE.map((s, i) => (
            <li key={s} className="flex items-center gap-2 text-[13px]">
              <span className="flex h-7 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-foreground">
                <span className="font-data text-[11px] text-muted-foreground">{i + 1}</span> {s}
              </span>
              {i < PIPELINE.length - 1 && <span className="text-muted-foreground">→</span>}
            </li>
          ))}
        </ol>
      </Reveal>
    </Section>
  );
}

export function ProblemsSection() {
  return (
    <Section
      id="problems"
      index="03 · Performance problems"
      title="Bottlenecks found by inspection"
      lede="Every item below was verified in the codebase before anything was changed."
    >
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {BOTTLENECKS.map((b) => (
          <Reveal key={b.title}>
            <div className="h-full rounded-xl border border-border bg-surface p-4">
              <p className="text-sm font-medium text-foreground">{b.title}</p>
              <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed">{b.detail}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

export function OptimizationsSection() {
  return (
    <Section
      id="optimizations"
      index="04 · Optimizations"
      title="Problem → solution → impact"
      lede="Concurrency stayed exactly 5 throughout; no collection, contract, or ranking changes."
    >
      <Reveal>
        <Table head={["Problem", "Solution", "Impact", "Status"]}>
          {OPTIMIZATIONS.map((o) => (
            <tr key={o.problem}>
              <td className="px-4 py-2.5 font-medium">{o.problem}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{o.solution}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{o.impact}</td>
              <td className="px-4 py-2.5"><Badge status={o.status} /></td>
            </tr>
          ))}
        </Table>
      </Reveal>
    </Section>
  );
}

export function ReliabilitySection() {
  return (
    <Section
      id="reliability"
      index="05 · Worker reliability"
      title="Five jobs, zero drama"
      lede="Attempts 3 · exponential 5s backoff · 180s lock · 300s timeout · per-candidate dedupe · fail-fast corrupt resumes."
    >
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {RELIABILITY.map((r) => (
          <Reveal key={r.name}>
            <div className="flex h-full flex-col gap-2 rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{r.name}</p>
                <Badge status={r.status} />
              </div>
              <p className="text-[13px] text-muted-foreground leading-relaxed">{r.detail}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

export function DashboardSection() {
  return (
    <Section
      id="dashboard"
      index="06 · Dashboard optimization"
      title="Less fetching, smarter caching"
      lede="One shared request instead of two, 84% fewer rows, a cache that actually connects, calmer polling, and skeletons instead of a blocking spinner."
    >
      <Reveal>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["1 request", "Shared SWR key + size 8 across page and notifications."],
            ["−84% rows", "Limit 8 on page, client, and backend default."],
            ["5-min cache", "Redis connects at boot; 10-min stale-while-revalidate."],
            ["Calm refresh", "120s poll, debounced + throttled socket refetch."],
            ["No spinner wall", "Section skeletons render progressively."],
            ["Fewer queries", "Empty ID lists skip doomed database round trips."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-xl border border-border bg-surface p-4">
              <p className="font-data text-lg font-medium text-foreground">{t}</p>
              <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </Section>
  );
}

export function EmbeddingsSection() {
  return (
    <Section
      id="embeddings"
      index="07 · Embeddings + Qdrant"
      title="Two components, two jobs"
      lede="MiniLM turns text into a 384-d vector. Qdrant stores those vectors and finds nearest neighbors by cosine distance. Same space in, same space out — which is why the model must never silently change."
    >
      <Reveal>
        <ol className="flex flex-col gap-2 md:flex-row md:items-center md:flex-wrap">
          {["MiniLM", "384-d vector", "Qdrant", "Top-K candidates"].map((s, i, a) => (
            <li key={s} className="flex items-center gap-2 text-[13px]">
              <span className="rounded-lg border border-border bg-surface px-3 py-2 font-medium text-foreground">{s}</span>
              {i < a.length - 1 && <span className="text-muted-foreground">→</span>}
            </li>
          ))}
        </ol>
      </Reveal>
      <div className="mt-6">
        <Reveal>
          <Table head={["Service / approach", "Verdict", "Result"]}>
            {COMPAT_MATRIX.map((c) => (
              <tr key={c.service}>
                <td className="px-4 py-2.5 font-medium">{c.service}</td>
                <td className="px-4 py-2.5"><Badge status={c.status} /></td>
                <td className="px-4 py-2.5 text-muted-foreground">{c.result}</td>
              </tr>
            ))}
          </Table>
        </Reveal>
      </div>
    </Section>
  );
}

export function ResultsSection() {
  return (
    <Section
      id="results"
      index="08 · Performance test results"
      title="Real staging numbers"
      lede="Five synthetic resumes processed concurrently; public API sampled idle and under load. Unmeasurable items are labeled, not filled in."
    >
      <Reveal>
        <h3 className="mb-3 text-sm font-medium text-foreground">API · idle vs 5 jobs running</h3>
        <Table head={["Metric", "Idle", "Busy", "Result"]}>
          {PERF_TABLE.map((r) => (
            <tr key={r.metric}>
              <td className="px-4 py-2.5 font-medium">{r.metric}</td>
              <td className="px-4 py-2.5 font-data text-[12px]">{r.idle}</td>
              <td className="px-4 py-2.5 font-data text-[12px]">{r.busy}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{r.result}</td>
            </tr>
          ))}
        </Table>
      </Reveal>
      <Reveal>
        <h3 className="mb-3 mt-8 text-sm font-medium text-foreground">Jobs · 11.8s wall, all overlapping</h3>
        <Table head={["Job", "Duration", "RSS", "Heap", "Retries", "Status"]}>
          {JOB_ROWS.map((r) => (
            <tr key={r.job}>
              <td className="px-4 py-2.5 font-medium">{r.job}</td>
              <td className="px-4 py-2.5 font-data text-[12px]">{r.duration}</td>
              <td className="px-4 py-2.5 font-data text-[12px]">{r.rss}</td>
              <td className="px-4 py-2.5 font-data text-[12px]">{r.heap}</td>
              <td className="px-4 py-2.5 font-data text-[12px]">{r.retries}</td>
              <td className="px-4 py-2.5"><Badge status="PASS" /></td>
            </tr>
          ))}
        </Table>
      </Reveal>
      <Reveal>
        <h3 className="mb-3 mt-8 text-sm font-medium text-foreground">Retrieval · top result per test JD</h3>
        <Table head={["Query", "Top candidate", "Semantic", "Overall", "Note"]}>
          {RETRIEVAL_ROWS.map((r) => (
            <tr key={r.jd}>
              <td className="px-4 py-2.5 font-medium">{r.jd}</td>
              <td className="px-4 py-2.5 font-data text-[12px]">{r.top}</td>
              <td className="px-4 py-2.5 font-data text-[12px]">{r.sem}</td>
              <td className="px-4 py-2.5 font-data text-[12px]">{r.overall}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{r.note}</td>
            </tr>
          ))}
        </Table>
        <p className="mt-3 text-xs text-muted-foreground">
          Formal retrieval accuracy was not measured because no labeled evaluation dataset was available.
        </p>
      </Reveal>
    </Section>
  );
}

export function RemainingSection() {
  return (
    <Section
      id="remaining"
      index="09 · Remaining work"
      title="What is still not optimized"
      lede="Verified gaps only — no speculation."
    >
      <Reveal>
        <ul className="space-y-2.5">
          {REMAINING.map((r) => (
            <li key={r} className="rounded-xl border border-border bg-surface p-4 text-[13px] text-muted-foreground leading-relaxed">
              {r}
            </li>
          ))}
        </ul>
      </Reveal>
    </Section>
  );
}

export function TechnicalReportSection() {
  return (
    <Section
      id="technical-report"
      index="10 · Technical report"
      title="Full report, on this page"
      lede="The complete evaluation also lives at docs/performance-optimization-report.md in the repository. Everything below is drawn from the same measured data — no secrets, no candidate PII."
    >
      <Reveal>
        <div className="rounded-xl border border-border bg-surface p-5 md:p-6 text-[13px] leading-relaxed text-muted-foreground space-y-3 max-w-none">
          <p><strong className="text-foreground">Executive summary.</strong> 5/5 staging jobs completed concurrently (11.8s wall, 0 failed, 0 retries, flat memory); the API stayed responsive (3–7ms root, ~0.5–1.0s health, unchanged under load); search and ranking behave over the untouched 384-d Qdrant collection; hosted alternatives failed validation, so production remains on local MiniLM with concurrency exactly 5.</p>
          <p><strong className="text-foreground">Reliability.</strong> Duplicate suppression yields one live job per candidate; corrupt resumes fail fast with a 400 while the worker stays alive; retries (3, exponential 5s), 180s lock, and 300s timeout bound every failure mode without infinite loops.</p>
          <p><strong className="text-foreground">Embeddings.</strong> Local MiniLM is the only production-compatible provider: Hugging Face serverless cannot serve raw vectors for this model (HTTP 400), and Cloudflare BGE-small — same 384 dimensions — sits in a different vector space (cosine 0.30, top-5 overlap 1–2/5). A future hosted option is safe only with identical weights plus passing staging gates.</p>
          <p><strong className="text-foreground">Before vs after.</strong> Measured: identical-byte vector reuse in 168ms, 0ms cache repeats, flat 31–35MB heap across 5 jobs. Code-level: single-request dashboard, working 5-minute cache, calm polling, BullMQ safeguards, parser guards, observability. Not yet measured: authed-endpoint deltas, dashboard render timing, live retry/timeout E2E, multi-hour soak.</p>
        </div>
      </Reveal>
    </Section>
  );
}
