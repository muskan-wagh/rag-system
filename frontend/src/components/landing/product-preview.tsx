"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { PIPELINE_STAGES, stageLabel } from "@/lib/pipeline"
import { ScoreRing } from "@/components/ui/score-ring"
import { StageBadge } from "@/components/ui/stage-badge"
import { ProgressBar } from "@/components/ui/progress-bar"
import { BrandMark } from "@/components/brand"

/* ------------------------------------------------------------------ *
 * Frame chrome
 * Every preview is explicitly labelled as sample data so nothing on the
 * marketing site can be mistaken for a live metric or a customer record.
 * ------------------------------------------------------------------ */

export function ProductFrame({
  url,
  children,
  className,
  label = "Product preview · sample data",
}: {
  url: string
  children: ReactNode
  className?: string
  label?: string
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-white/10 bg-[#0A0B0A]",
        "shadow-[0_30px_80px_-32px_rgba(0,0,0,0.95)]",
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b border-white/[0.07] bg-white/[0.02] px-3.5 py-2.5">
        <div className="flex gap-1.5" aria-hidden>
          <span className="size-2 rounded-full bg-white/15" />
          <span className="size-2 rounded-full bg-white/15" />
          <span className="size-2 rounded-full bg-white/15" />
        </div>
        <div className="min-w-0 flex-1 truncate rounded-md border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 font-data text-[10.5px] text-faint">
          {url}
        </div>
        <span className="hidden shrink-0 rounded-full border border-white/[0.07] bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium text-faint sm:inline">
          {label}
        </span>
      </div>
      {children}
    </div>
  )
}

/** Miniature replica of the authenticated app shell (sidebar + top bar). */
function MiniShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex bg-[#070908]">
      <div className="hidden w-[132px] shrink-0 flex-col gap-0.5 border-r border-white/[0.07] bg-white/[0.015] p-2.5 sm:flex">
        <div className="mb-2 flex items-center gap-1.5 px-1 py-1">
          <BrandMark size={16} />
          <span className="text-[10.5px] font-medium text-ink">HireStack</span>
        </div>
        {["Dashboard", "Candidates", "Jobs", "Assessments", "Interviews"].map((item, i) => (
          <div
            key={item}
            className={cn(
              "rounded-md px-2 py-1.5 text-[10.5px]",
              i === 2 ? "bg-surface-secondary font-medium text-ink" : "text-muted",
            )}
          >
            {item}
          </div>
        ))}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Shared sample rows — deliberately generic, clearly labelled sample data
 * ------------------------------------------------------------------ */

interface SampleCandidate {
  name: string
  role: string
  skills: string[]
  score: number
  stage: string
  flag?: string
}

const PIPELINE_SAMPLES: SampleCandidate[] = [
  {
    name: "Sample candidate A",
    role: "Senior Backend Engineer",
    skills: ["Go", "Postgres", "Kubernetes"],
    score: 0.94,
    stage: "Assessment",
  },
  {
    name: "Sample candidate B",
    role: "Platform Engineer",
    skills: ["Rust", "AWS", "Terraform"],
    score: 0.89,
    stage: "Screening",
    flag: "Skill gap: Kafka",
  },
  {
    name: "Sample candidate C",
    role: "Full-Stack Engineer",
    skills: ["TypeScript", "React", "Node"],
    score: 0.86,
    stage: "Technical Round",
  },
  {
    name: "Sample candidate D",
    role: "Data Engineer",
    skills: ["Python", "Spark", "dbt"],
    score: 0.81,
    stage: "Applied",
  },
]

/* ------------------------------------------------------------------ *
 * 1. Job workspace — the pipeline a recruiter actually works in
 * ------------------------------------------------------------------ */

export function PipelinePreview({ className }: { className?: string }) {
  return (
    <ProductFrame url="hirestack.app/jobs/senior-platform-engineer" className={className}>
      <MiniShell>
        <div className="space-y-3 p-3.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[12px] font-medium text-ink">Senior Platform Engineer</p>
              <p className="text-[10.5px] text-muted">Remote · Full-time · 1 opening</p>
            </div>
            <span className="rounded-md border border-accent-border bg-accent-soft px-2 py-1 text-[10px] font-medium text-accent">
              Screening complete
            </span>
          </div>

          <ol className="flex flex-wrap gap-1" aria-label="Hiring pipeline">
            {PIPELINE_STAGES.map((stage, i) => {
              const counts = [1, 1, 1, 1, 0, 0, 0]
              const count = counts[i]
              const state = count > 0 ? (i === 3 ? "current" : "completed") : "upcoming"
              return (
                <li
                  key={stage}
                  className={cn(
                    "rounded-md border px-2 py-1",
                    state === "completed" && "border-success/25 bg-success/10",
                    state === "current" && "border-accent-border bg-accent-soft",
                    state === "upcoming" && "border-border bg-surface",
                  )}
                >
                  <span
                    className={cn(
                      "block text-[9.5px] font-medium leading-tight",
                      state === "upcoming" ? "text-muted" : "text-ink",
                    )}
                  >
                    {stageLabel(stage)}
                  </span>
                  <span className="block font-data text-[11px] font-medium text-ink">{count}</span>
                </li>
              )
            })}
          </ol>

          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
            <div className="grid grid-cols-[1fr_auto] gap-2 border-b border-border bg-canvas px-3 py-1.5 text-[9.5px] font-medium uppercase tracking-[0.06em] text-muted">
              <span>Candidate</span>
              <span>Match</span>
            </div>
            {PIPELINE_SAMPLES.map((c) => (
              <div
                key={c.name}
                className="grid grid-cols-[1fr_auto] items-center gap-2 border-b border-border px-3 py-2 last:border-0"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11.5px] font-medium text-ink">{c.name}</span>
                    <StageBadge stage={c.stage} size="sm" />
                  </div>
                  <p className="mt-0.5 truncate text-[10px] text-muted">
                    {c.skills.join(" · ")}
                    {c.flag && <span className="ml-1.5 text-warning">{c.flag}</span>}
                  </p>
                </div>
                <ScoreRing
                  value={c.score}
                  size={30}
                  strokeWidth={3}
                  color="var(--accent)"
                  trackColor="var(--track)"
                />
              </div>
            ))}
          </div>
        </div>
      </MiniShell>
    </ProductFrame>
  )
}

/* ------------------------------------------------------------------ *
 * 2. AI screening — ranked, explained matches
 * ------------------------------------------------------------------ */

const SCREENING_DIMENSIONS = [
  { label: "Skills", value: 0.91 },
  { label: "Experience", value: 0.86 },
  { label: "Education", value: 0.74 },
  { label: "Overall", value: 0.88 },
]

export function ScreeningPreview({ className }: { className?: string }) {
  return (
    <ProductFrame url="hirestack.app/jobs/senior-platform-engineer/screening" className={className}>
      <div className="grid gap-0 sm:grid-cols-[1.25fr_1fr]">
        <div className="border-b border-border p-3.5 sm:border-b-0 sm:border-r">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[12px] font-medium text-ink">AI screening results</p>
            <span className="rounded-md border border-border bg-canvas px-2 py-0.5 font-data text-[10px] text-muted">
              4 ranked
            </span>
          </div>
          <div className="space-y-2">
            {[
              { label: "Skills match", v: 0.91, note: "5 of 6 required skills found" },
              { label: "Experience fit", v: 0.86, note: "6 yrs vs 5 yrs target" },
              { label: "Education", v: 0.74, note: "Degree field not specified in JD" },
            ].map((d) => (
              <ProgressBar key={d.label} value={d.v * 100} label={d.label} size="sm" color="bg-accent" />
            ))}
          </div>
          <div className="mt-3 rounded-lg border border-accent-border bg-accent-soft p-2.5">
            <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-accent">
              Why this match
            </p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-ink">
              Ranked above the cut-off because the resume states ownership of a
              Kubernetes platform in production. Missing Kafka experience is the only gap.
            </p>
          </div>
        </div>

        <div className="p-3.5">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
            Score breakdown
          </p>
          <div className="flex flex-col gap-3">
            {SCREENING_DIMENSIONS.map((d) => (
              <div key={d.label} className="flex items-center gap-3">
                <ScoreRing
                  value={d.value}
                  size={38}
                  strokeWidth={3}
                  color={d.label === "Overall" ? "var(--accent)" : "var(--ink)"}
                />
                <span className="text-[11px] text-muted">{d.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ProductFrame>
  )
}

/* ------------------------------------------------------------------ *
 * 3. Assessments — generated, published, taken
 * ------------------------------------------------------------------ */

export function AssessmentPreview({ className }: { className?: string }) {
  return (
    <ProductFrame url="hirestack.app/assessments/platform-algorithms" className={className}>
      <div className="p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[12px] font-medium text-ink">Platform algorithms</p>
            <p className="text-[10.5px] text-muted">6 questions · 45 min · passing 70%</p>
          </div>
          <span className="rounded-full border border-success/25 bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
            Published
          </span>
        </div>

        <div className="mt-3 space-y-1.5">
          {[
            { n: "1", type: "Multiple choice", q: "Which isolation level prevents phantom reads?" },
            { n: "2", type: "Coding", q: "Implement a bounded worker pool with backpressure" },
            { n: "3", type: "SQL", q: "Rank sessions per user by recency" },
          ].map((item) => (
            <div
              key={item.n}
              className="flex items-start gap-2.5 rounded-lg border border-border bg-canvas px-2.5 py-2"
            >
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded bg-ink font-data text-[9px] text-canvas">
                {item.n}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[11px] text-ink">{item.q}</p>
                <p className="mt-0.5 text-[9.5px] uppercase tracking-[0.06em] text-muted">
                  {item.type}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-lg border border-border bg-canvas p-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted">
              Coding sandbox
            </span>
            <span className="font-data text-[10px] text-faint">python</span>
          </div>
          <pre className="overflow-hidden font-data text-[10px] leading-[1.5] text-ink">
{`def worker_pool(jobs, size):
    queue = Queue(maxsize=size)
    ...`}
          </pre>
          <div className="mt-2 flex items-center gap-2">
            <span className="rounded-md bg-ink px-2 py-1 text-[10px] font-medium text-canvas">Run</span>
            <span className="font-data text-[10px] text-success">3 / 4 test cases passed</span>
          </div>
        </div>
      </div>
    </ProductFrame>
  )
}

/* ------------------------------------------------------------------ *
 * 4. Interviews — video room + live coding
 * ------------------------------------------------------------------ */

export function InterviewPreview({ className }: { className?: string }) {
  return (
    <ProductFrame url="hirestack.app/interview/join/technical" className={className}>
      <div className="grid gap-0 sm:grid-cols-2">
        <div className="border-b border-border p-3.5 sm:border-b-0 sm:border-r">
          <p className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
            Technical interview
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Interviewer", tone: "bg-surface-secondary" },
              { label: "Candidate", tone: "bg-surface-secondary" },
            ].map((tile) => (
              <div
                key={tile.label}
                className={cn(
                  "flex aspect-video items-center justify-center rounded-lg border border-border",
                  tile.tone,
                )}
              >
                <span className="text-[9.5px] text-faint">{tile.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-2.5 flex items-center gap-1.5">
            {["Mic", "Cam", "Share", "End"].map((c) => (
              <span
                key={c}
                className={cn(
                  "rounded-md border border-border bg-surface px-2 py-1 text-[9.5px] text-muted",
                  c === "End" && "border-danger/30 text-danger",
                )}
              >
                {c}
              </span>
            ))}
          </div>
        </div>

        <div className="p-3.5">
          <p className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
            Live coding
          </p>
          <pre className="overflow-hidden rounded-lg border border-border bg-canvas p-2.5 font-data text-[10px] leading-[1.5] text-ink">
{`def flatten(rows):
    out = []
    for r in rows:
        out += r
    return out`}
          </pre>
          <div className="mt-2 space-y-1">
            {[
              { i: "Case 1", ok: true },
              { i: "Case 2", ok: true },
              { i: "Case 3", ok: false },
            ].map((t) => (
              <div key={t.i} className="flex items-center justify-between font-data text-[10px]">
                <span className="text-muted">{t.i}</span>
                <span className={t.ok ? "text-success" : "text-danger"}>
                  {t.ok ? "pass" : "fail"}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2.5 rounded-lg border border-border bg-canvas p-2">
            <p className="text-[9.5px] uppercase tracking-[0.06em] text-muted">Scorecard</p>
            <p className="mt-0.5 text-[10.5px] text-ink">2 of 4 competencies scored</p>
          </div>
        </div>
      </div>
    </ProductFrame>
  )
}

/* ------------------------------------------------------------------ *
 * 5. Analytics — stage distribution and funnel health
 * ------------------------------------------------------------------ */

export function AnalyticsPreview({ className }: { className?: string }) {
  const bars = [
    { stage: "Applied", value: 1.0 },
    { stage: "Screening", value: 0.72 },
    { stage: "Assessment", value: 0.48 },
    { stage: "Technical", value: 0.31 },
    { stage: "Managerial / HR", value: 0.18 },
    { stage: "Offer", value: 0.09 },
    { stage: "Hired", value: 0.06 },
  ]

  return (
    <ProductFrame url="hirestack.app/dashboard" className={className}>
      <div className="p-3.5">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Open roles", value: "—", sub: "sample" },
            { label: "In pipeline", value: "—", sub: "sample" },
            { label: "Needs review", value: "—", sub: "sample" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-canvas p-2.5">
              <p className="text-[9.5px] uppercase tracking-[0.06em] text-muted">{s.label}</p>
              <p className="mt-1 font-data text-[16px] font-medium text-ink">{s.value}</p>
              <p className="text-[9px] text-faint">{s.sub}</p>
            </div>
          ))}
        </div>

        <p className="mb-2.5 mt-4 text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
          Candidates by stage
        </p>
        <div className="space-y-1.5">
          {bars.map((b) => (
            <div key={b.stage} className="flex items-center gap-2.5">
              <span className="w-[86px] shrink-0 truncate text-[10.5px] text-muted">{b.stage}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-track">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${b.value * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </ProductFrame>
  )
}
