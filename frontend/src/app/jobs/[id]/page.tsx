"use client"
/* eslint-disable react-hooks/set-state-in-effect -- tab sync + initial data-load effects set state after navigation/fetch */

import { useCallback, useEffect, useMemo, useState, startTransition, Suspense } from "react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import {
  ArrowLeft, ArrowUpRight, Bot, Briefcase, Check, FlaskConical,
  Loader2, Play, RefreshCw, Send, Settings2, Users, XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { useApi } from "@/hooks/use-api"
import { ROUTES, getInitials } from "@/lib/constants"
import type { MinimalJob, Assessment } from "@/lib/types"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { ScoreRing } from "@/components/ui/score-ring"
import { AvatarExtended, AvatarFallback } from "@/components/ui/avatar"
import { JobPipelineStepper, withStepperStates } from "@/components/job-pipeline-stepper"
import { JobPipelineTable } from "@/components/job-pipeline-table"

type StageKey = "overview" | "candidates" | "screening" | "assessment" | "technical" | "hr" | "final" | "analytics" | "settings"

const STAGE_TABS: Array<{ key: StageKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "candidates", label: "Candidates" },
  { key: "screening", label: "Screening" },
  { key: "assessment", label: "Assessment" },
  { key: "technical", label: "Technical" },
  { key: "hr", label: "HR" },
  { key: "final", label: "Decisions" },
  { key: "analytics", label: "Analytics" },
  { key: "settings", label: "Settings" },
]

interface ScreeningRow {
  candidate_id: string
  overall: number
  semantic_score: number
  skills_score: number
  experience_score: number
  education_score: number
  status: string
  matched_skills: string[]
  missing_skills: string[]
  explanation: string
  recruiter_override: boolean
  candidates?: { id: string; full_name: string; email: string } | null
}

interface Summary {
  jobId: string
  total: number
  stages: Record<string, number>
  stageCandidates: Record<string, string[]>
  screening: { screened: number; passed: number; failed: number; overridden: number; passRate: number }
  assessment: { templatePublished: boolean; invited: number; started: number; completed: number; passed: number; passRate: number }
  technical: { count: number; technical: number; hr: number; evalOutcomes: Record<string, number> }
  final: { decisions: number; hired: number; rejected: number }
  dropOffs: { screeningFailed: number; assessmentNotPassed: number; rejected: number }
}

const CONFIG_LABELS: Array<{ key: string; title: string; hint: string }> = [
  { key: "screening_to_assessment", title: "Screening pass → Assessment eligible", hint: "Passed candidates appear in Assessment without a manual move." },
  { key: "assessment_to_technical", title: "Assessment pass → Technical Interview", hint: "Passed attempts auto-create the Technical Interview stage." },
  { key: "technical_to_hr", title: "Technical pass → HR", hint: "Positive technical evaluations advance to Managerial/HR." },
  { key: "hr_to_offer", title: "HR pass → Offer stage", hint: "Positive HR evaluations advance to Offer. Hiring itself stays manual." },
]

function CandidateChip({ id, name, stage }: { id: string; name: string; stage?: string | null }) {
  return (
    <Link
      href={ROUTES.candidateDetail(id)}
      className="flex items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-2 transition-colors hover:bg-surface-secondary"
    >
      <AvatarExtended stage={stage} size="sm">
        <AvatarFallback className="text-xs">{getInitials(name)}</AvatarFallback>
      </AvatarExtended>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium">{name}</span>
        <span className="block text-[11px] text-muted">View profile →</span>
      </span>
    </Link>
  )
}

export default function JobOverviewPage() {
  return (
    <Suspense fallback={<div className="space-y-6 pt-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-24 w-full" /></div>}>
      <JobOverviewInner />
    </Suspense>
  )
}

function JobOverviewInner() {
  const params = useParams()
  const searchParams = useSearchParams()
  const jobId = String(params.id || "")
  const api = useApi()

  const initialStage = useMemo<StageKey>(() => {
    const s = searchParams.get("stage")
    return STAGE_TABS.some((t) => t.key === s) ? (s as StageKey) : "overview"
  }, [searchParams])
  const [stage, setStage] = useState<StageKey>(initialStage)
  useEffect(() => setStage(initialStage), [initialStage])

  const [job, setJob] = useState<MinimalJob | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [config, setConfig] = useState<Record<string, boolean> | null>(null)
  const [screeningRows, setScreeningRows] = useState<ScreeningRow[]>([])
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [runningScreening, setRunningScreening] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const [genForm, setGenForm] = useState({ mcq: 8, coding: 2, sql: 1, subjective: 1, difficulty: "mixed", duration: 60, passing: 60 })

  const load = useCallback(async (silent = false) => {
    if (!jobId) return
    if (!silent) startTransition(() => setLoading(true))
    else setRefreshing(true)
    try {
      const [jobsRes, summaryRes, configRes, screeningRes, assessmentsRes] = await Promise.all([
        api.listJobs(),
        api.getHiringSummary(jobId),
        api.getJobConfig(jobId),
        api.listScreeningResults(jobId),
        api.listAssessments({ jobId }),
      ])
      if (jobsRes.success && jobsRes.data) {
        startTransition(() => setJob(jobsRes.data?.find((j) => j.id === jobId) || null))
      }
      if (summaryRes.success && summaryRes.data) setSummary(summaryRes.data as Summary)
      if (configRes.success && configRes.data) setConfig(configRes.data.progression_config)
      if (screeningRes.success && screeningRes.data) {
        setScreeningRows(screeningRes.data as unknown as ScreeningRow[])
      }
      if (assessmentsRes.success && assessmentsRes.data) setAssessments(assessmentsRes.data)
    } catch {
      toast.error("Failed to load job overview")
    } finally {
      startTransition(() => setLoading(false))
      setRefreshing(false)
    }
  }, [api, jobId])

  useEffect(() => {
    load()
  }, [load])

  const nameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of screeningRows) {
      if (r.candidates?.full_name) map.set(r.candidate_id, r.candidates.full_name)
    }
    return map
  }, [screeningRows])

  const displayName = useCallback((id: string) => nameById.get(id) || `${id.slice(0, 8)}…`, [nameById])

  const steps = useMemo(() => {
    if (!summary) return []
    const s = summary.stages
    const link = (st: StageKey) => `${ROUTES.jobDetail(jobId)}?stage=${st}`
    return withStepperStates([
      { key: "applied", label: "Applied", count: s.applied || 0, href: link("overview") },
      { key: "screening", label: "Screening", count: s.screening || 0, href: link("screening") },
      { key: "assessment", label: "Assessment", shortLabel: "Assess.", count: s.assessment || 0, href: link("assessment") },
      { key: "technical", label: "Technical Interview", shortLabel: "Technical", count: s.technical || 0, href: link("technical") },
      { key: "hr", label: "Managerial / HR", shortLabel: "HR", count: s.hr || 0, href: link("hr") },
      { key: "finalDecision", label: "Final Decision", shortLabel: "Decision", count: s.finalDecision || 0, href: link("final") },
      { key: "hired", label: "Hired", count: s.hired || 0, href: link("final") },
    ])
  }, [summary, jobId])

  const stageIds = useCallback((key: string) => summary?.stageCandidates?.[key] || [], [summary])

  async function handleRunScreening() {
    setRunningScreening(true)
    try {
      const res = await api.runScreening(jobId)
      if (res.success) {
        toast.success(res.data?.deduplicated ? "Screening already running" : "Screening queued — results will appear here")
        setStage("screening")
      } else toast.error("Failed to queue screening")
    } catch {
      toast.error("Failed to queue screening")
    } finally {
      setRunningScreening(false)
    }
  }

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await api.generateAssessment({
        job_id: jobId,
        question_types: {
          mcq: genForm.mcq,
          coding: genForm.coding,
          sql: genForm.sql,
          subjective: genForm.subjective,
        },
        difficulty: genForm.difficulty,
        duration_minutes: genForm.duration,
        passing_score: genForm.passing,
      })
      if (res.success && res.data) {
        toast.success(`Draft ready: ${res.data.questions.length} questions${res.data.dropped ? ` (${res.data.dropped} dropped)` : ""}. Review before publishing.`)
        load(true)
        window.location.href = ROUTES.assessmentDetail(res.data.assessmentId)
      } else toast.error("Generation failed")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed")
    } finally {
      setGenerating(false)
    }
  }

  async function toggleConfig(key: string, value: boolean) {
    if (!config) return
    const next = { ...config, [key]: value }
    setConfig(next)
    setSavingConfig(true)
    try {
      const res = await api.updateJobConfig(jobId, next)
      if (!(res.success && res.data)) {
        setConfig(config)
        toast.error("Failed to save setting")
      }
    } catch {
      setConfig(config)
      toast.error("Failed to save setting")
    } finally {
      setSavingConfig(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 pt-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!job) {
    return (
      <div className="pt-6">
        <EmptyState
          icon={Briefcase}
          title="Job not found"
          description="This job is missing or belongs to another recruiter."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 pt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={ROUTES.jobs}
            className="mb-1 inline-flex items-center gap-1 text-xs text-muted hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Jobs
          </Link>
          <PageHeader title={job.title} description={job.description?.slice(0, 180) || "Job hiring workspace"} />
        </div>
        <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {steps.length > 0 ? (
        <div className="rounded-xl border border-border bg-surface p-4 shadow-xs">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">
            Hiring pipeline — click a stage to see its candidates
          </p>
          <JobPipelineStepper steps={steps} />
        </div>
      ) : null}

      <Tabs value={stage} onValueChange={(v) => setStage(v as StageKey)}>
        <TabsList aria-label="Job sections">
          {STAGE_TABS.map((t) => (
            <TabsTab key={t.key} value={t.key}>
              {t.label}
              {t.key === "screening" && summary ? (
                <span className="font-data ml-1.5 rounded-full bg-soft px-1.5 text-[10px] tabular-nums">{summary.stages.screening || 0}</span>
              ) : null}
              {t.key === "assessment" && summary ? (
                <span className="font-data ml-1.5 rounded-full bg-soft px-1.5 text-[10px] tabular-nums">{summary.stages.assessment || 0}</span>
              ) : null}
            </TabsTab>
          ))}
        </TabsList>

        <TabsPanel value="overview">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-surface p-4 shadow-xs">
              <p className="text-xs font-medium text-muted">Screening pass rate</p>
              <p className="font-data mt-1 text-2xl font-semibold tabular-nums">{summary?.screening.passRate || 0}%</p>
              <p className="mt-1 text-xs text-muted">
                {summary?.screening.passed || 0} passed · {summary?.screening.failed || 0} failed · {summary?.screening.screened || 0} screened
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 shadow-xs">
              <p className="text-xs font-medium text-muted">Assessment pass rate</p>
              <p className="font-data mt-1 text-2xl font-semibold tabular-nums">{summary?.assessment.passRate || 0}%</p>
              <p className="mt-1 text-xs text-muted">
                {summary?.assessment.invited || 0} invited · {summary?.assessment.completed || 0} completed · {summary?.assessment.passed || 0} passed
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 shadow-xs">
              <p className="text-xs font-medium text-muted">Interviews & outcomes</p>
              <p className="font-data mt-1 text-2xl font-semibold tabular-nums">{summary?.technical.count || 0}</p>
              <p className="mt-1 text-xs text-muted">
                {summary?.technical.technical || 0} technical · {summary?.technical.hr || 0} HR · {summary?.final.hired || 0} hired
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="action" size="sm" onClick={handleRunScreening} disabled={runningScreening}>
              {runningScreening ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Run Screening
            </Button>
            <Button variant="outline" size="sm" onClick={() => setStage("assessment")}>
              <Bot className="h-3.5 w-3.5" /> Generate Assessment
            </Button>
            <Link href={ROUTES.jobScreening(jobId)}>
              <Button variant="outline" size="sm">
                Open screening workspace <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </TabsPanel>

        <TabsPanel value="candidates">
          <JobPipelineTable jobId={jobId} />
        </TabsPanel>

        <TabsPanel value="screening">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted">
              {summary?.screening.screened || 0} screened · {summary?.screening.passed || 0} passed · {summary?.screening.failed || 0} failed
              {summary?.screening.overridden ? ` · ${summary.screening.overridden} overridden` : ""}
            </p>
            <div className="flex gap-2">
              <Button variant="action" size="sm" onClick={handleRunScreening} disabled={runningScreening}>
                {runningScreening ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                Run Screening
              </Button>
              <Link href={ROUTES.jobScreening(jobId)}>
                <Button variant="outline" size="sm">Full workspace <ArrowUpRight className="h-3.5 w-3.5" /></Button>
              </Link>
            </div>
          </div>
          {screeningRows.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No screening results yet"
              description="Run screening to score candidates with the RAG pipeline. Passed candidates become assessment-eligible."
            />
          ) : (
            <ul className="space-y-2">
              {screeningRows.slice(0, 30).map((row) => (
                <li key={row.candidate_id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-3 shadow-xs">
                  <ScoreRing value={Math.max(0, Math.min(1, row.overall / 100))} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={ROUTES.candidateDetail(row.candidate_id)} className="truncate text-sm font-medium hover:underline">
                        {row.candidates?.full_name || displayName(row.candidate_id)}
                      </Link>
                      <Badge variant={row.status === "passed" ? "success" : row.status === "failed" ? "destructive" : "secondary"}>
                        {row.status}
                      </Badge>
                      {row.recruiter_override ? <Badge variant="secondary">overridden</Badge> : null}
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      Semantic {Math.round(row.semantic_score)}% · Skills {Math.round(row.skills_score)}% · Exp {Math.round(row.experience_score)}% · Edu {Math.round(row.education_score)}%
                    </p>
                    {(row.matched_skills || []).length > 0 ? (
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted">
                        Matched: {row.matched_skills.slice(0, 8).join(", ")}
                        {(row.missing_skills || []).length > 0 ? ` · Missing: ${row.missing_skills.slice(0, 5).join(", ")}` : ""}
                      </p>
                    ) : null}
                  </div>
                  <Link href={`${ROUTES.jobScreening(jobId)}`}>
                    <Button variant="ghost" size="sm">Reasoning</Button>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsPanel>

        <TabsPanel value="assessment">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface p-4 shadow-xs">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <Bot className="h-4 w-4 text-accent" /> Generate Assessment with AI
              </h3>
              <p className="mt-1 text-xs text-muted">
                Built from this job&apos;s description plus screening skill insights. Always a draft — you review before publishing.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(["mcq", "coding", "sql", "subjective"] as const).map((t) => (
                  <label key={t} className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs">
                    <span className="font-medium uppercase">{t}</span>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={genForm[t]}
                      onChange={(e) => setGenForm((f) => ({ ...f, [t]: Math.max(0, Math.min(30, Number(e.target.value) || 0)) }))}
                      className="w-14 rounded border border-border bg-background px-1.5 py-0.5 text-right tabular-nums"
                    />
                  </label>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <label className="text-xs">Difficulty
                  <select
                    value={genForm.difficulty}
                    onChange={(e) => setGenForm((f) => ({ ...f, difficulty: e.target.value }))}
                    className="mt-1 w-full rounded border border-border bg-background px-1.5 py-1"
                  >
                    <option value="mixed">Mixed</option>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </label>
                <label className="text-xs">Duration (min)
                  <input
                    type="number" min={5} max={480} value={genForm.duration}
                    onChange={(e) => setGenForm((f) => ({ ...f, duration: Math.max(5, Number(e.target.value) || 60) }))}
                    className="mt-1 w-full rounded border border-border bg-background px-1.5 py-1 tabular-nums"
                  />
                </label>
                <label className="text-xs">Passing score
                  <input
                    type="number" min={0} value={genForm.passing}
                    onChange={(e) => setGenForm((f) => ({ ...f, passing: Math.max(0, Number(e.target.value) || 0) }))}
                    className="mt-1 w-full rounded border border-border bg-background px-1.5 py-1 tabular-nums"
                  />
                </label>
              </div>
              <Button variant="action" size="sm" className="mt-3" onClick={handleGenerate} disabled={generating}>
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
                {generating ? "Generating…" : "Generate Assessment"}
              </Button>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 shadow-xs">
              <h3 className="text-sm font-medium">Job assessments</h3>
              <p className="mt-1 text-xs text-muted">
                One template per role — eligible candidates share it.
                {summary ? ` ${summary.assessment.invited} invited · ${summary.assessment.completed} completed · ${summary.assessment.passed} passed.` : ""}
              </p>
              {assessments.length === 0 ? (
                <p className="mt-3 text-xs text-muted">No assessment yet. Generate one with AI or create it manually.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {assessments.map((a) => (
                    <li key={a.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{a.name || "Untitled assessment"}</p>
                        <p className="text-[11px] text-muted">
                          {a.totalQuestions} questions · {a.totalMarks} marks · {a.duration_minutes} min
                        </p>
                      </div>
                      <Badge variant={a.status === "published" ? "success" : "secondary"}>{a.status}</Badge>
                      <Link href={ROUTES.assessmentDetail(a.id)}>
                        <Button variant="outline" size="xs">{a.status === "published" ? "Invites" : "Review"}</Button>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <Link href={ROUTES.assessmentNew} className="mt-3 inline-block">
                <Button variant="ghost" size="sm">Create manually instead</Button>
              </Link>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-border bg-surface p-4 shadow-xs">
            <h3 className="text-sm font-medium">Assessment-eligible candidates ({stageIds("assessment").length})</h3>
            <p className="mt-1 text-xs text-muted">Screening-passed candidates for this job. Invites are sent from the published assessment.</p>
            {stageIds("assessment").length === 0 ? (
              <p className="mt-2 text-xs text-muted">Nobody eligible yet — pass candidates in Screening first.</p>
            ) : (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {stageIds("assessment").slice(0, 12).map((id) => (
                  <CandidateChip key={id} id={id} name={displayName(id)} stage="Assessment" />
                ))}
              </div>
            )}
          </div>
        </TabsPanel>

        <TabsPanel value="technical">
          <StageCandidateList
            title="Technical Interview"
            ids={stageIds("technical")}
            empty="No candidates in Technical Interview yet. Passed assessments move here (automatically if enabled, otherwise via recruiter move)."
            displayName={displayName}
            stage="Technical Interview"
          />
        </TabsPanel>

        <TabsPanel value="hr">
          <StageCandidateList
            title="Managerial / HR"
            ids={stageIds("hr")}
            empty="No candidates in HR yet. Positive technical evaluations advance here."
            displayName={displayName}
            stage="Managerial/HR"
          />
        </TabsPanel>

        <TabsPanel value="final">
          <div className="grid gap-4 md:grid-cols-3">
            <FinalCard label="Final Decision" count={summary?.stages.finalDecision || 0} ids={stageIds("finalDecision")} displayName={displayName} />
            <FinalCard label="Hired" count={summary?.stages.hired || 0} ids={stageIds("hired")} displayName={displayName} positive />
            <FinalCard label="Rejected" count={summary?.stages.rejected || 0} ids={stageIds("rejected")} displayName={displayName} negative />
          </div>
          <p className="mt-3 text-xs text-muted">
            Final decisions and candidate-safe reports live on each candidate profile (Reports section). Hiring is always a manual recruiter decision.
          </p>
        </TabsPanel>

        <TabsPanel value="analytics">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricTile label="Pipeline total" value={summary?.total ?? 0} />
              <MetricTile
                label="Screening pass rate"
                value={summary?.screening.passRate ?? 0}
                suffix="%"
                hint={`${summary?.screening.passed ?? 0} of ${summary?.screening.screened ?? 0} screened`}
              />
              <MetricTile
                label="Assessment pass rate"
                value={summary?.assessment.passRate ?? 0}
                suffix="%"
                hint={`${summary?.assessment.passed ?? 0} of ${summary?.assessment.completed ?? 0} completed`}
              />
              <MetricTile
                label="Hires"
                value={summary?.stages.hired ?? 0}
                hint={`${summary?.final.rejected ?? 0} rejected`}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <MetricTile label="Screened" value={summary?.screening.screened ?? 0} />
              <MetricTile label="Assessment completed" value={summary?.assessment.completed ?? 0} />
              <MetricTile label="Interviews" value={summary?.technical.count ?? 0} />
            </div>

            <div className="rounded-xl border border-border bg-surface p-4 shadow-xs">
              <h3 className="text-sm font-medium">Drop-offs</h3>
              <p className="mt-1 text-xs text-muted">
                Counted from persisted records for this job. Historical events — a candidate who
                passed screening last week is counted as an event, not as a current stage.
              </p>
              <dl className="mt-3 grid gap-2 sm:grid-cols-3">
                <DropOff label="Failed screening" value={summary?.dropOffs.screeningFailed ?? 0} />
                <DropOff label="Did not pass assessment" value={summary?.dropOffs.assessmentNotPassed ?? 0} />
                <DropOff label="Rejected overall" value={summary?.dropOffs.rejected ?? 0} />
              </dl>
            </div>

            {Object.keys(summary?.technical.evalOutcomes ?? {}).length > 0 ? (
              <div className="rounded-xl border border-border bg-surface p-4 shadow-xs">
                <h3 className="text-sm font-medium">Interviewer recommendations</h3>
                <dl className="mt-3 grid gap-2 sm:grid-cols-3">
                  {Object.entries(summary?.technical.evalOutcomes ?? {}).map(([k, v]) => (
                    <DropOff key={k} label={k.replace(/_/g, " ")} value={v} />
                  ))}
                </dl>
              </div>
            ) : null}
          </div>
        </TabsPanel>

        <TabsPanel value="settings">
          <div className="rounded-xl border border-border bg-surface p-4 shadow-xs">
            <h3 className="flex items-center gap-2 text-sm font-medium">
              <Settings2 className="h-4 w-4" /> Automatic progression {savingConfig ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            </h3>
            <p className="mt-1 text-xs text-muted">
              Invitations and scheduling always stay recruiter-controlled. Final hiring is never automatic.
            </p>
            <div className="mt-3 space-y-2">
              {CONFIG_LABELS.map((c) => (
                <label key={c.key} className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2.5">
                  <span>
                    <span className="block text-[13px] font-medium">{c.title}</span>
                    <span className="block text-xs text-muted">{c.hint}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={!!config?.[c.key]}
                    onChange={(e) => toggleConfig(c.key, e.target.checked)}
                    className="mt-1 h-4 w-4 accent-accent"
                  />
                </label>
              ))}
            </div>
          </div>
        </TabsPanel>
      </Tabs>
    </div>
  )
}

function StageCandidateList({ title, ids, empty, displayName, stage }: {
  title: string
  ids: string[]
  empty: string
  displayName: (id: string) => string
  stage: string
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-xs">
      <h3 className="text-sm font-medium">{title} ({ids.length})</h3>
      {ids.length === 0 ? (
        <p className="mt-2 text-xs text-muted">{empty}</p>
      ) : (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {ids.slice(0, 24).map((id) => (
            <CandidateChip key={id} id={id} name={displayName(id)} stage={stage} />
          ))}
        </div>
      )}
    </div>
  )
}

function FinalCard({ label, count, ids, displayName, positive, negative }: {
  label: string
  count: number
  ids: string[]
  displayName: (id: string) => string
  positive?: boolean
  negative?: boolean
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-xs">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
        {positive ? <Check className="h-3.5 w-3.5 text-success" /> : negative ? <XCircle className="h-3.5 w-3.5 text-danger" /> : <Send className="h-3.5 w-3.5" />}
        {label}
      </p>
      <p className="font-data mt-1 text-2xl font-semibold tabular-nums">{count}</p>
      <div className="mt-2 space-y-1.5">
        {ids.slice(0, 6).map((id) => (
          <CandidateChip key={id} id={id} name={displayName(id)} stage={positive ? "Hired" : negative ? "Rejected" : "Offer"} />
        ))}
      </div>
    </div>
  )
}

function MetricTile({ label, value, suffix, hint }: { label: string; value: number; suffix?: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-xs">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-data text-2xl font-semibold tabular-nums">
        {value}
        {suffix ? <span className="ml-0.5 text-sm font-normal text-muted">{suffix}</span> : null}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  )
}

function DropOff({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
      <dt className="text-xs capitalize text-text-secondary">{label}</dt>
      <dd className="font-data text-sm font-medium tabular-nums">{value}</dd>
    </div>
  )
}
