"use client"

import { useState, useCallback, useRef, useMemo, memo } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  Sparkles, RefreshCw, Loader2, ShieldAlert, Plus,
  FilePlus, Copy, Check, Users, Briefcase,
  BadgeCheck, ArrowUpRight, ArrowRight, Bot, CalendarDays,
  ChevronRight,
} from "lucide-react"
import { toast } from "sonner"
import { CandidateDetailModal } from "@/components/candidate-detail-modal"
import { useApi } from "@/hooks/use-api"
import { useDashboard, DASHBOARD_PAGE_SIZE } from "@/hooks/use-dashboard"
import { useWebSocket } from "@/lib/use-websocket"
import { ROUTES, getInitials } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { StageDot } from "@/components/ui/stage-badge"
import { PanelHeader } from "@/components/ui/panel-header"
import { KpiCard, useGreeting } from "@/components/dashboard/kpi-card"
import { PipelineFlow } from "@/components/dashboard/pipeline-flow"

import { NeedsReviewCard } from "@/components/dashboard/needs-review-card"
import { AiRecommendations } from "@/components/dashboard/ai-recommendations"
import { UpcomingInterviews } from "@/components/dashboard/upcoming-interviews"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { TalentPoolsSummary } from "@/components/dashboard/talent-pools-summary"
import { QuickActions } from "@/components/dashboard/quick-actions"

interface SessionData {
  sessionId: string
  link: string
}

interface CandidateRow {
  id: string
  full_name?: string
  current_company?: string
  current_title?: string
  total_experience_years?: number
  flight_risk?: string
  growth_trajectory?: string
  match_score?: number
  status?: string
  current_status?: string
  email?: string
  phone?: string
  location?: string
  raw_resume_text?: string
  skills?: string[]
  resume_file_url?: string
}

interface BiasIssue {
  category: string
  text: string
  suggestion: string
}

const CandidateRowCard = memo(function CandidateRowCard({
  candidate,
  onSelect,
}: {
  candidate: CandidateRow
  onSelect: (c: CandidateRow) => void
}) {
  const stage = candidate.current_status || candidate.status || "Applied"
  const score = candidate.match_score

  return (
    <button
      type="button"
      onClick={() => onSelect(candidate)}
      className={cn(
        "group flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left",
        "transition-all duration-150 hover:border-border-hover hover:shadow-xs",
      )}
    >
      <Avatar className="size-9 shrink-0">
        <AvatarFallback className="font-data text-[11px] font-medium">
          {getInitials(candidate.full_name)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-[13px] font-medium text-ink">
            {candidate.full_name || "Unknown"}
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
            <StageDot stage={stage} />
            {stage}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[11.5px] text-muted">
          {[candidate.current_title, candidate.current_company].filter(Boolean).join(" · ") ||
            "No title on record"}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        {typeof score === "number" && (
          <>
            <div className="hidden h-1 w-14 overflow-hidden rounded-full bg-track sm:block">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.max(0, Math.min(100, Math.round(score)))}%` }}
              />
            </div>
            <span className="font-data text-[12px] font-medium text-ink">
              {Math.round(score)}%
            </span>
          </>
        )}
        <ChevronRight
          className="size-3.5 shrink-0 text-faint transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-muted"
          strokeWidth={1.5}
          aria-hidden
        />
      </div>
    </button>
  )
})

export default function DashboardPage() {
  const [jdText, setJdText] = useState("")
  const [session, setSession] = useState<SessionData | null>(null)
  const [generating, setGenerating] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateRow | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)
  const [scanningBias, setScanningBias] = useState(false)
  const [biasResult, setBiasResult] = useState<{
    has_bias: boolean
    issues: BiasIssue[]
    suggestions: string[]
  } | null>(null)
  const [, setBiasError] = useState("")
  const [page] = useState(1)
  const wsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastWsMutateRef = useRef(0)
  const [userClearedSession, setUserClearedSession] = useState(false)

  const api = useApi()
  const {
    data, stats, candidates, sessions: sessList, isLoading, isValidating, mutate,
    candidatesRequiringReview, aiRecommendedCandidates, upcomingInterviews,
    recentActivity, topTalentPools, quickActions,
  } = useDashboard(page, DASHBOARD_PAGE_SIZE)

  const defaultSession = useMemo(() => {
    if (!data || userClearedSession) return null
    const latestSession = sessList?.[0]
    if (latestSession) return { sessionId: latestSession.id, link: `/upload/${latestSession.id}` }
    return null
  }, [data, sessList, userClearedSession])

  const effectiveSession = session ?? defaultSession
  const sessionUrl =
    typeof window !== "undefined" && effectiveSession
      ? `${window.location.origin}${effectiveSession.link}`
      : effectiveSession?.link || ""

  const wordCount = useMemo(() => (jdText.trim() ? jdText.trim().split(/\s+/).length : 0), [jdText])

  // Hero covers the "new session" shortcut — only surface the remaining
  // contextual quick actions (review / interviews / offers) to avoid duplication.
  const contextualActions = useMemo(
    () => quickActions.filter((a) => a.id !== "new-session"),
    [quickActions],
  )

  const handleWsRefresh = useCallback(() => {
    // Coalesce bursts, skip hidden tabs, and throttle to at most one
    // revalidation per 30s — the 120s SWR poll already keeps data fresh.
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return
    if (Date.now() - lastWsMutateRef.current < 30_000) return
    if (wsDebounceRef.current) clearTimeout(wsDebounceRef.current)
    wsDebounceRef.current = setTimeout(() => {
      lastWsMutateRef.current = Date.now()
      mutate()
    }, 2000)
  }, [mutate])

  // Interview events are rare and directly affect the Upcoming Interviews
  // widget, so refresh promptly (debounced only) instead of sharing the 30s
  // status-change throttle — otherwise a just-scheduled interview stays
  // invisible until the next poll.
  const handleInterviewRefresh = useCallback(() => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return
    if (wsDebounceRef.current) clearTimeout(wsDebounceRef.current)
    wsDebounceRef.current = setTimeout(() => {
      lastWsMutateRef.current = Date.now()
      mutate()
    }, 2000)
  }, [mutate])

  useWebSocket("candidate:status_changed", handleWsRefresh)
  useWebSocket("interview:scheduled", handleInterviewRefresh)
  useWebSocket("interview:updated", handleInterviewRefresh)

  const focusWorkspace = useCallback(() => {
    const el = document.getElementById("jd-textarea") as HTMLTextAreaElement | null
    if (el) el.focus()
    el?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [])

  const generateLink = useCallback(async () => {
    if (!jdText.trim()) return
    setGenerating(true)
    setError("")
    try {
      const res = await api.generateLink(jdText)
      if (res.success && res.data) {
        const { sessionId, link } = res.data
        setSession({ sessionId, link })
        mutate()
        toast.success("Application link generated")
      } else {
        setError(res.error || "Failed to generate link")
      }
    } catch {
      setError("Could not reach the server. Check your connection and try again.")
    } finally {
      setGenerating(false)
    }
  }, [jdText, api, mutate])

  const handleBiasScan = useCallback(async () => {
    if (!jdText.trim()) return
    setScanningBias(true)
    setBiasResult(null)
    setBiasError("")
    try {
      const result = await api.scanBias(jdText)
      if (result.success && result.data) {
        setBiasResult(result.data)
        if (result.data.has_bias) {
          toast.warning(`${result.data.issues.length} potential bias issue(s) found`)
        } else {
          toast.success("No bias detected in this job description")
        }
      } else {
        setBiasError(result.error || "Bias scan failed")
      }
    } catch {
      setBiasError("Could not scan for bias")
    } finally {
      setScanningBias(false)
    }
  }, [jdText, api])

  const handleNewSession = () => {
    setUserClearedSession(true)
    setSession(null)
    setJdText("")
    setBiasResult(null)
    setError("")
    mutate()
    toast.success("New hiring session started")
  }

  const handleSelectCandidate = (candidate: CandidateRow) => {
    setSelectedCandidate(candidate)
    setShowDetailModal(true)
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(sessionUrl)
    } catch {
      const input = document.createElement("textarea")
      input.value = sessionUrl
      document.body.appendChild(input)
      input.select()
      document.execCommand("copy")
      document.body.removeChild(input)
    }
    setCopied(true)
    toast.success("Application link copied")
    setTimeout(() => setCopied(false), 2000)
  }

  const routerPush = useCallback((href: string) => {
    if (typeof window !== "undefined") window.location.href = href
  }, [])

  const handleQuickAction = useCallback(
    (action: string) => {
      if (action === "scroll-to-workspace") focusWorkspace()
      else if (action === "scroll-to-needs-review")
        document.getElementById("needs-review-section")?.scrollIntoView({ behavior: "smooth" })
      else if (action === "scroll-to-interviews")
        document.getElementById("interviews-section")?.scrollIntoView({ behavior: "smooth" })
      else if (action === "navigate-offers") routerPush(`${ROUTES.candidates}?status=offer`)
    },
    [focusWorkspace, routerPush],
  )

  // Progressive loading: keep the workspace interactive on first paint and
  // show section-level skeletons instead of a full-screen blocking spinner.
  const showInitialSkeleton = isLoading && !data

  const stageNodes = useMemo(
    () => [
      { label: "Applied", count: stats?.applied ?? 0, href: `${ROUTES.candidates}?status=applied` },
      { label: "Screening", count: stats?.screening ?? 0, href: `${ROUTES.candidates}?status=screening` },
      { label: "Assessment", count: stats?.assessment ?? 0, href: `${ROUTES.candidates}?status=assessment` },
      { label: "Technical", count: stats?.technical ?? 0, href: `${ROUTES.candidates}?status=technical` },
      { label: "HR", count: stats?.hr ?? 0, href: `${ROUTES.candidates}?status=hr` },
      { label: "Offer", count: stats?.finalDecision ?? 0, href: `${ROUTES.candidates}?status=offer` },
      { label: "Hired", count: stats?.hired ?? 0, href: `${ROUTES.candidates}?status=hired` },
      { label: "Rejected", count: stats?.rejected ?? 0, href: `${ROUTES.candidates}?status=rejected` },
    ],
    [stats],
  )

  const inPipeline = (stats?.open ?? 0) + (stats?.rejected ?? 0) + (stats?.hired ?? 0) || 1

  const kpis = [
    {
      label: "Total candidates",
      value: stats?.totalCandidates ?? 0,
      icon: Users,
      href: ROUTES.candidates,
      caption: "Across every hiring session",
      tone: "accent" as const,
      fill: 1,
    },
    {
      label: "In progress",
      value: stats?.open ?? 0,
      icon: Briefcase,
      href: `${ROUTES.candidates}?status=open`,
      caption: `${stats?.applied ?? 0} applied · ${stats?.screening ?? 0} screening`,
      tone: "warning" as const,
      fill: (stats?.open ?? 0) / inPipeline,
    },
    {
      label: "Interviews",
      value: stats?.interviewsToday ?? 0,
      icon: CalendarDays,
      href: ROUTES.interview,
      caption: stats?.interviewsToday ? "Scheduled for today" : "Nothing booked today",
      tone: "info" as const,
      fill: Math.min(1, (stats?.interviewsToday ?? 0) / 8),
    },
    {
      label: "Hired",
      value: stats?.hired ?? 0,
      icon: BadgeCheck,
      href: `${ROUTES.candidates}?status=hired`,
      caption: `${stats?.offered ?? 0} awaiting a decision`,
      tone: "success" as const,
      fill: (stats?.hired ?? 0) / inPipeline,
    },
  ]

  const { greeting: hello, name } = useGreeting()

  return (
    <div className="min-w-0 max-w-full space-y-5 sm:space-y-6">
      {/* ——— Header ——— */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="truncate text-[26px] font-medium leading-tight tracking-[-0.03em] text-ink sm:text-[30px]">
              {hello}
              {name !== "there" && <span className="text-muted">, {name}</span>}
            </h1>
            <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-success/25 bg-success/10 px-2 py-0.5 text-[10.5px] font-medium text-success sm:inline-flex">
              <span className="size-1.5 animate-pulse-soft rounded-full bg-success" aria-hidden />
              Live
            </span>
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            {stats?.totalCandidates
              ? `${stats.totalCandidates.toLocaleString()} candidates · ${stats.open ?? 0} in progress · ${stats.interviewsToday ?? 0} interviews today`
              : "Create a hiring session to start screening candidates."}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" render={<Link href={ROUTES.candidates} />}>
            <Users />
            Candidates
          </Button>
          <Button variant="action" onClick={focusWorkspace}>
            <Plus strokeWidth={2.25} />
            New session
          </Button>
        </div>
      </motion.header>

      {contextualActions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
        >
          <QuickActions items={contextualActions} onAction={handleQuickAction} />
        </motion.div>
      )}

      {/* ——— KPI row ——— */}
      <motion.section
        aria-label="Key metrics"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
        className="grid grid-cols-2 gap-2.5 lg:grid-cols-4"
      >
        {showInitialSkeleton
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[132px] rounded-xl" />
            ))
          : kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
      </motion.section>

      {/* ——— Pipeline ——— */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
          <div>
            <h2 className="text-[13.5px] font-medium tracking-tight text-ink">Hiring pipeline</h2>
            <p className="mt-0.5 text-[11.5px] text-muted">
              Every stage links to the candidates sitting in it
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => mutate()}
              disabled={isValidating}
              className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12px] font-medium text-muted transition-colors hover:bg-hover-tone hover:text-ink disabled:opacity-50"
            >
              <RefreshCw
                className={cn("size-3.5", isValidating && "animate-spin")}
                strokeWidth={1.75}
                aria-hidden
              />
              Refresh
            </button>
            <Link
              href={ROUTES.candidates}
              className="group inline-flex h-7 items-center gap-0.5 rounded-lg px-2 text-[12px] font-medium text-muted transition-colors hover:bg-hover-tone hover:text-ink"
            >
              View all
              <ChevronRight
                className="size-3.5 transition-transform group-hover:translate-x-0.5"
                strokeWidth={1.75}
                aria-hidden
              />
            </Link>
          </div>
        </div>

        <div className="px-4 py-5 sm:px-5">
          {showInitialSkeleton ? (
            <Skeleton className="h-[104px] w-full rounded-xl" />
          ) : (
            <PipelineFlow stages={stageNodes} />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-canvas/50 px-4 py-2.5 sm:px-5">
          <p className="text-[11.5px] text-muted">
            Applied → Screening → Assessment → Technical → HR → Offer → Hired
          </p>
          <p className="font-data text-[11.5px] text-muted">
            <span className="font-medium text-ink">{(stats?.totalCandidates ?? 0).toLocaleString()}</span>{" "}
            candidates tracked
          </p>
        </div>
      </motion.section>

      {/* ——— Create session ——— */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
        className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs"
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <Bot className="size-4" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[13.5px] font-medium leading-tight text-ink">
              Create a hiring session
            </h2>
            <p className="truncate text-[11.5px] text-muted">
              Paste a job description to generate an application link and pipeline.
            </p>
          </div>
          {isValidating && (
            <RefreshCw
              className="size-3.5 shrink-0 animate-spin text-faint"
              strokeWidth={1.75}
              aria-label="Refreshing"
            />
          )}
        </div>

        <div className="p-4 sm:p-5">
          <label htmlFor="jd-textarea" className="sr-only">
            Job description
          </label>
          <Textarea
            id="jd-textarea"
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            placeholder="Paste the full job description — title, responsibilities, required skills, experience and education."
            className="min-h-[96px] resize-y"
          />

          {error && (
            <Alert variant="destructive" className="mt-3 py-2.5">
              <AlertDescription className="text-[12px]">{error}</AlertDescription>
            </Alert>
          )}

          {biasResult?.has_bias && (
            <Alert variant="warning" className="mt-3 py-2.5">
              <ShieldAlert className="size-3.5" />
              <AlertDescription>
                <p className="text-[12px] font-medium">
                  {biasResult.issues.length} potential bias issue(s) found
                </p>
                {biasResult.issues.slice(0, 2).map((issue, i) => (
                  <p key={i} className="mt-0.5 text-[11px]">
                    [{issue.category}] {issue.suggestion}
                  </p>
                ))}
              </AlertDescription>
            </Alert>
          )}

          {biasResult && !biasResult.has_bias && (
            <Alert variant="success" className="mt-3 py-2.5">
              <ShieldAlert className="size-3.5" />
              <AlertDescription className="text-[12px] font-medium">
                No bias detected in this job description.
              </AlertDescription>
            </Alert>
          )}

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBiasScan}
                disabled={scanningBias || !jdText.trim()}
              >
                {scanningBias ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <ShieldAlert className="text-warning" strokeWidth={1.75} />
                )}
                {scanningBias ? "Scanning…" : "Check for bias"}
              </Button>
              <span className="text-[11px] text-faint">
                <span className="font-data">{wordCount}</span> words
              </span>
            </div>

            <Button
              variant="action"
              onClick={generateLink}
              disabled={generating || !jdText.trim()}
              className="w-full sm:w-auto"
            >
              {generating ? <Loader2 className="animate-spin" /> : <Sparkles strokeWidth={1.75} />}
              {generating ? "Generating…" : "Create session"}
              {!generating && <ArrowRight strokeWidth={2} aria-hidden />}
            </Button>
          </div>
        </div>

        {effectiveSession && (
          <div className="flex flex-col gap-2 border-t border-border bg-canvas/50 px-4 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-5">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <span className="size-1.5 shrink-0 animate-pulse-soft rounded-full bg-success" aria-hidden />
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-[0.07em] text-faint">
                  Active application link
                </p>
                <p className="truncate font-data text-[11.5px] text-ink">{sessionUrl}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button variant="subtle" size="sm" onClick={handleCopyLink}>
                {copied ? <Check strokeWidth={2} /> : <Copy strokeWidth={1.75} />}
                {copied ? "Copied" : "Copy link"}
              </Button>
              <Button variant="outline" size="sm" onClick={handleNewSession}>
                <Plus strokeWidth={2} />
                New
              </Button>
            </div>
          </div>
        )}
      </motion.section>

      {/* ——— Panels ——— */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="grid min-w-0 gap-4 lg:grid-cols-2"
      >
        <div id="needs-review-section" className="min-w-0">
          <NeedsReviewCard items={candidatesRequiringReview} />
        </div>
        <div id="interviews-section" className="min-w-0">
          <UpcomingInterviews items={upcomingInterviews} />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="grid min-w-0 gap-4 lg:grid-cols-2"
      >
        <div className="min-w-0">
          <AiRecommendations items={aiRecommendedCandidates} />
        </div>
        <div className="min-w-0">
          <RecentActivity items={recentActivity} />
        </div>
      </motion.div>

      {(topTalentPools.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.26, ease: [0.16, 1, 0.3, 1] }}
          className="min-w-0"
        >
          <TalentPoolsSummary items={topTalentPools} />
        </motion.div>
      )}

      {/* ——— Recent uploads ——— */}
      {(showInitialSkeleton || candidates.length > 0) && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="min-w-0"
        >
          <PanelHeader
            title="Recent uploads"
            description={
              candidates.length > 0
                ? `${candidates.length} candidate${candidates.length === 1 ? "" : "s"} in your pipeline`
                : "Start receiving candidates"
            }
            className="mb-2.5"
            action={
              candidates.length > 0 ? (
                <Link
                  href={
                    effectiveSession?.sessionId
                      ? `${ROUTES.candidates}?session=${effectiveSession.sessionId}`
                      : ROUTES.candidates
                  }
                >
                  <Button variant="outline" size="sm">
                    View all
                    <ArrowUpRight strokeWidth={1.75} />
                  </Button>
                </Link>
              ) : undefined
            }
          />

          {showInitialSkeleton || (isValidating && !candidates.length) ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
                >
                  <Skeleton className="size-9 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-36" />
                    <Skeleton className="h-2.5 w-24" />
                  </div>
                  <Skeleton className="h-3 w-10" />
                </div>
              ))}
            </div>
          ) : candidates.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-8">
              <div className="mx-auto flex max-w-xs flex-col items-center text-center">
                <span className="mb-3 flex size-10 items-center justify-center rounded-xl border border-border bg-canvas">
                  <Users className="size-4 text-faint" strokeWidth={1.5} aria-hidden />
                </span>
                <h3 className="mb-1 text-[13.5px] font-medium text-ink">No candidates yet</h3>
                <p className="mb-4 text-[12.5px] leading-relaxed text-muted">
                  Paste a job description above to generate an application link, then
                  share it wherever you post the role.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button variant="action" size="sm" onClick={focusWorkspace}>
                    <FilePlus />
                    Paste job description
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleNewSession}>
                    <Plus strokeWidth={2} />
                    New session
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {candidates.slice(0, 5).map((candidate) => (
                <CandidateRowCard
                  key={candidate.id}
                  candidate={candidate}
                  onSelect={handleSelectCandidate}
                />
              ))}
            </div>
          )}
        </motion.section>
      )}

      <CandidateDetailModal
        open={showDetailModal}
        onClose={() => {
          setShowDetailModal(false)
          setSelectedCandidate(null)
        }}
        candidate={selectedCandidate}
        onStatusChange={() => mutate()}
      />
    </div>
  )
}
