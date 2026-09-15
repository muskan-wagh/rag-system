"use client"

import { useState, useCallback, useRef, useMemo, memo } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  Sparkles, RefreshCw, Loader2, ShieldAlert, Plus,
  FilePlus, Copy, Check, Users, Briefcase,
  BadgeCheck, ArrowUpRight, ArrowRight, Clock, Bot,
  ChevronRight,
} from "lucide-react"
import { toast } from "sonner"
import { CandidateDetailModal } from "@/components/candidate-detail-modal"
import { useApi } from "@/hooks/use-api"
import { useDashboard, DASHBOARD_PAGE_SIZE } from "@/hooks/use-dashboard"
import { useWebSocket } from "@/lib/use-websocket"
import { ROUTES, getInitials } from "@/lib/constants"
import type { SessionStats } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusDot } from "@/components/ui/status-dot"
import { PanelHeader } from "@/components/ui/panel-header"

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

/** Restrained indigo primary CTA (Vercel/Linear-style accent). */
const ACCENT_CTA =
  "group bg-indigo-500 text-white border border-transparent hover:bg-indigo-400 active:scale-[0.98] rounded-md"

function DisplayNumber({ value }: { value: number }) {
  return <span className="font-data">{value.toLocaleString()}</span>
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.02 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] as const } },
}

function statCards(stats: SessionStats | null) {
  return [
    {
      href: ROUTES.candidates,
      label: "Total Candidates",
      value: stats?.totalCandidates ?? 0,
      icon: Users,
      iconClass: "text-indigo-500 dark:text-indigo-400",
    },
    {
      href: ROUTES.candidates,
      label: "Uploaded Today",
      value: stats?.uploadedToday ?? 0,
      icon: Clock,
      iconClass: "text-info",
    },
    {
      href: ROUTES.candidates,
      label: "In Progress",
      value: stats?.open ?? 0,
      icon: Briefcase,
      iconClass: "text-warning",
      sub: `${stats?.applied ?? 0} applied · ${stats?.screening ?? 0} screening · ${stats?.interview ?? 0} interview`,
    },
    {
      href: `${ROUTES.candidates}?status=hired,offer`,
      label: "Hired",
      value: (stats?.hired ?? 0) + (stats?.offered ?? 0),
      icon: BadgeCheck,
      iconClass: "text-success",
      sub: `${stats?.hired ?? 0} hired · ${stats?.offered ?? 0} pending`,
    },
  ]
}

const CandidateCard = memo(function CandidateCard({
  candidate,
  onSelect,
}: {
  candidate: CandidateRow
  onSelect: (c: CandidateRow) => void
  index?: number
}) {
  return (
    <motion.div
      variants={itemVariants}
      className="group cursor-pointer overflow-hidden rounded-md border border-border bg-surface transition-all duration-120 hover:border-border-hover hover:bg-hover-tone/40 hover:shadow-sm active:scale-[0.995]"
      onClick={() => onSelect(candidate)}
    >
      <div className="p-3">
        <div className="flex items-center gap-2.5">
          <Avatar className="size-8 shrink-0">
            <AvatarFallback className="text-[11px] font-medium">
              {getInitials(candidate.full_name)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[13px] font-medium text-ink">
              {candidate.full_name || "Unknown"}
            </h3>

            <p className="truncate text-[11px] text-muted">
              {candidate.current_title || ""}
              {candidate.current_title && candidate.current_company ? " · " : ""}
              {candidate.current_company || ""}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="font-data text-[11px] font-medium text-ink">
              {candidate.match_score !== undefined ? `${Math.round(candidate.match_score)}%` : "—"}
            </span>
            <div className="hidden h-1 w-12 overflow-hidden rounded-full bg-track min-[420px]:block">
              <div
                className="h-full rounded-full bg-info"
                style={{ width: `${Math.round(candidate.match_score ?? 0)}%` }}
              />
            </div>
            <div className="hidden items-center min-[420px]:flex">
              <StatusDot status={candidate.current_status || candidate.status || "Applied"} />
              <span className="text-[11px] text-muted">
                {candidate.current_status || candidate.status || "Applied"}
              </span>
            </div>
            <ChevronRight className="size-3.5 shrink-0 text-faint opacity-0 transition-all duration-120 group-hover:translate-x-px group-hover:opacity-100" strokeWidth={1.5} aria-hidden />
          </div>
        </div>
      </div>
    </motion.div>
  )
})

function PipelineStepper({ stats }: { stats: SessionStats | null }) {
  const stages = [
    { label: "Applied", value: stats?.applied ?? 0, bar: "bg-info" },
    { label: "Screening", value: stats?.screening ?? 0, bar: "bg-info" },
    { label: "Interview", value: stats?.interview ?? 0, bar: "bg-info" },
    { label: "Offer", value: stats?.offered ?? 0, bar: "bg-info" },
    { label: "Hired", value: stats?.hired ?? 0, bar: "bg-success" },
  ]
  const max = Math.max(1, ...stages.map((s) => s.value))
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-[520px] gap-2 sm:min-w-0 sm:gap-3">
        {stages.map((stage) => (
          <div key={stage.label} className="group min-w-0 flex-1 cursor-default">
            <div className="flex items-baseline justify-between gap-1">
              <span className="truncate text-[11px] text-muted transition-colors duration-120 group-hover:text-ink">{stage.label}</span>
              <span className="font-data text-[12px] font-medium text-ink">
                <DisplayNumber value={stage.value} />
              </span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-track">
              <div
                className={`h-full rounded-full transition-[width] duration-500 ${stage.bar}`}
                style={{ width: `${Math.round((stage.value / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [jdText, setJdText] = useState("")
  const [session, setSession] = useState<SessionData | null>(null)
  const [generating, setGenerating] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateRow | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)
  const [scanningBias, setScanningBias] = useState(false)
  const [biasResult, setBiasResult] = useState<{ has_bias: boolean; issues: BiasIssue[]; suggestions: string[] } | null>(null)
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
    if (latestSession) {
      return { sessionId: latestSession.id, link: `/upload/${latestSession.id}` }
    }
    return null
  }, [data, sessList, userClearedSession])

  const effectiveSession = session ?? defaultSession
  const sessionUrl =
    typeof window !== "undefined" && effectiveSession
      ? `${window.location.origin}${effectiveSession.link}`
      : effectiveSession?.link || ""

  const wordCount = useMemo(
    () => (jdText.trim() ? jdText.trim().split(/\s+/).length : 0),
    [jdText],
  )

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

  useWebSocket('candidate:status_changed', handleWsRefresh)
  // Interview reschedule/cancel only emits interview:updated (no status change),
  // so without these listeners the Upcoming Interviews widget never refreshes.
  useWebSocket('interview:scheduled', handleInterviewRefresh)
  useWebSocket('interview:updated', handleInterviewRefresh)

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
        toast.success("Application link generated!")
      } else {
        setError(res.error || "Failed to generate link")
      }
    } catch {
      setError("Failed to connect to server")
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
          toast.warning(`${result.data.issues.length} bias issue(s) detected`)
        } else {
          toast.success("No bias detected!")
        }
      } else {
        setBiasError(result.error || "Bias scan failed")
      }
    } catch {
      setBiasError("Failed to scan for bias")
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
    toast.success("New session started")
  }

  const handleSelectCandidate = (candidate: CandidateRow) => {
    setSelectedCandidate(candidate)
    setShowDetailModal(true)
  }

  const handleCopyLink = async () => {
    const url = sessionUrl
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const input = document.createElement("textarea")
      input.value = url
      document.body.appendChild(input)
      input.select()
      document.execCommand("copy")
      document.body.removeChild(input)
    }
    setCopied(true)
    toast.success("Copied to clipboard!")
    setTimeout(() => setCopied(false), 2000)
  }

  const handleQuickAction = useCallback((action: string) => {
    if (action === "scroll-to-workspace") {
      focusWorkspace()
    } else if (action === "scroll-to-needs-review") {
      document.getElementById("needs-review-section")?.scrollIntoView({ behavior: "smooth" })
    } else if (action === "scroll-to-interviews") {
      document.getElementById("interviews-section")?.scrollIntoView({ behavior: "smooth" })
    } else if (action === "navigate-offers") {
      window.location.href = `${ROUTES.candidates}?status=offered`
    }
  }, [focusWorkspace])

  const statsList = statCards(stats)
  // Progressive loading: keep the workspace interactive on first paint and
  // show section-level skeletons instead of a full-screen blocking spinner.
  const showInitialSkeleton = isLoading && !data

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="min-w-0 max-w-full space-y-4 sm:space-y-5"
    >
      {/* Hero */}
      <motion.div variants={itemVariants} className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 shrink-0 text-indigo-500 dark:text-indigo-400" strokeWidth={1.75} aria-hidden />
            <h1 className="truncate text-[20px] font-medium leading-tight tracking-tight text-ink sm:text-[24px]">
              AI Hiring Workspace
            </h1>
            <span className="hidden shrink-0 items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted min-[420px]:inline-flex">
              <span className="size-1 rounded-full bg-success" />
              Live
            </span>
          </div>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted sm:text-[13px]">
            Manage candidates, create hiring sessions, and make faster hiring decisions with AI.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 min-[420px]:flex-row sm:w-auto">
          <Link href={ROUTES.candidates} className="min-w-0 flex-1 min-[420px]:flex-none">
            <Button size="sm" className="h-8 w-full bg-ink text-canvas hover:bg-ink/90 hover:text-canvas text-[12.5px] min-[420px]:w-auto">
              <Users className="size-3.5" strokeWidth={1.5} />
              Review Candidates
            </Button>
          </Link>
          <Button size="sm" className={`h-8 flex-1 text-[12.5px] min-[420px]:flex-none ${ACCENT_CTA}`} onClick={focusWorkspace}>
            <Plus className="size-3.5 transition-transform duration-120 group-hover:scale-110" strokeWidth={2} />
            New Hiring Session
          </Button>
        </div>
      </motion.div>

      {/* Contextual quick actions (backend-driven shortcuts) */}
      {contextualActions.length > 0 && (
        <motion.div variants={itemVariants} className="min-w-0">
          <QuickActions items={contextualActions} onAction={handleQuickAction} />
        </motion.div>
      )}

      {/* Hiring session — single compact card */}
      <motion.div variants={itemVariants} className="min-w-0">
        <div className="overflow-hidden rounded-md border border-border bg-surface">
          <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5 sm:px-3.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-secondary text-indigo-500 dark:text-indigo-400">
              <Bot className="size-4" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium leading-tight text-ink">Create a hiring session</p>
              <p className="truncate text-[11px] text-muted sm:text-[12px]">
                Paste a job description to generate an AI-powered application link and pipeline.
              </p>
            </div>
            {isValidating && (
              <RefreshCw className="ml-auto size-3.5 shrink-0 animate-spin text-faint" strokeWidth={1.5} />
            )}
          </div>

          <div className="p-3 sm:p-3.5">
            <Textarea
              id="jd-textarea"
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder="Paste the full job description here..."
              className="h-[88px] min-h-[88px] resize-none sm:h-[96px] sm:min-h-[96px]"
            />

            {error && (
              <Alert variant="destructive" className="mt-2.5">
                <AlertDescription className="text-[12px]">{error}</AlertDescription>
              </Alert>
            )}

            {biasResult && biasResult.has_bias && (
              <Alert variant="warning" className="mt-2.5">
                <ShieldAlert className="h-3.5 w-3.5" />
                <AlertDescription>
                  <p className="text-[12px] font-medium">{biasResult.issues.length} bias issue(s) found</p>
                  {biasResult.issues.slice(0, 2).map((issue, i) => (
                    <p key={i} className="mt-0.5 text-[11px]">[{issue.category}] {issue.suggestion}</p>
                  ))}
                </AlertDescription>
              </Alert>
            )}

            {biasResult && !biasResult.has_bias && (
              <Alert variant="success" className="mt-2.5">
                <ShieldAlert className="h-3.5 w-3.5" />
                <AlertDescription className="text-[12px] font-medium">
                  No bias detected — JD looks great!
                </AlertDescription>
              </Alert>
            )}

            <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-7 text-[12px]" onClick={handleBiasScan} disabled={scanningBias || !jdText.trim()}>
                  {scanningBias ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <ShieldAlert className="size-3.5 text-warning" strokeWidth={1.75} />
                  )}
                  {scanningBias ? "Scanning..." : "Check Bias"}
                </Button>
                <span className="flex items-center gap-1.5 text-[11px] text-faint">
                  <span className="size-1 rounded-full bg-border-hover" />
                  <span className="font-data">{wordCount}</span> words parsed
                </span>
              </div>
              <Button size="sm" className={`h-8 w-full text-[12.5px] sm:w-auto ${ACCENT_CTA}`} onClick={generateLink} disabled={generating || !jdText.trim()}>
                {generating ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" strokeWidth={1.5} />
                )}
                {generating ? "Generating..." : "Create Hiring Session"}
                {!generating && (
                  <ArrowRight
                    className="size-3.5 transition-transform duration-120 group-hover:translate-x-0.5"
                    strokeWidth={2}
                    aria-hidden
                  />
                )}
              </Button>
            </div>
          </div>

          {effectiveSession && (
            <div className="flex min-w-0 flex-col gap-2 border-t border-border bg-canvas/40 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3 sm:px-3.5">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="size-1.5 shrink-0 animate-pulse-soft rounded-full bg-success" />
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-faint">
                    Active Application Link
                  </p>
                  <p className="truncate font-data text-[12px] text-ink">
                    {sessionUrl}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  onClick={handleCopyLink}
                  className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-muted transition-all duration-120 hover:bg-surface-secondary hover:text-ink active:scale-[0.98]"
                >
                  {copied ? (
                    <Check className="size-3.5" strokeWidth={2} />
                  ) : (
                    <Copy className="size-3.5" strokeWidth={1.5} />
                  )}
                  {copied ? "Copied" : "Copy Link"}
                </button>
                <Button variant="outline" size="sm" className="h-7 text-[12px]" onClick={handleNewSession}>
                  <Plus className="size-3.5" strokeWidth={1.5} />
                  New Session
                </Button>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Pipeline metrics */}
      <section id="pipeline-metrics" className="min-w-0">
        <PanelHeader
          title="Hiring pipeline"
          description="Candidate volume across your active funnel"
          className="mb-2"
          action={
            <div className="flex items-center gap-2">
              {effectiveSession && (
                <button
                  onClick={() => mutate()}
                  disabled={isValidating}
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-muted transition-all duration-120 hover:text-ink active:scale-[0.98] disabled:opacity-50"
                >
                  <RefreshCw className={`size-3.5 ${isValidating ? "animate-spin" : ""}`} strokeWidth={1.5} />
                  Refresh
                </button>
              )}
              <Link
                href={ROUTES.candidates}
                className="group inline-flex items-center gap-0.5 text-[12px] font-medium text-muted transition-colors duration-120 hover:text-ink"
              >
                View pipeline
                <ChevronRight className="size-3.5 transition-transform duration-120 group-hover:translate-x-px" strokeWidth={1.5} />
              </Link>
            </div>
          }
        />
        <div className="grid grid-cols-2 gap-2 sm:gap-2.5 xl:grid-cols-4">
          {showInitialSkeleton
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-md border border-border bg-surface p-3">
                  <Skeleton className="h-2.5 w-20" />
                  <Skeleton className="mt-2.5 h-6 w-12" />
                  <Skeleton className="mt-1.5 h-2.5 w-24" />
                </div>
              ))
            : statsList.map((card) => (
            <motion.div key={card.label} variants={itemVariants} className="min-w-0">
              <Link href={card.href}>
                <div className="group rounded-md border border-border bg-surface p-3 transition-all duration-120 hover:border-border-hover hover:shadow-sm active:scale-[0.99] sm:p-3.5">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="truncate text-[10px] font-medium uppercase tracking-[0.06em] text-faint sm:text-[11px]">
                      {card.label}
                    </span>
                    <card.icon className={`size-3.5 shrink-0 ${card.iconClass}`} strokeWidth={1.75} />
                  </div>
                  <p className="mt-2 font-data text-[20px] font-medium leading-none text-ink sm:text-[22px]">
                    <DisplayNumber value={card.value} />
                  </p>
                  {card.sub && <p className="mt-1.5 truncate text-[10.5px] text-faint sm:text-[11px]">{card.sub}</p>}
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Pipeline stepper — real stage counts only */}
        <div className="mt-2 rounded-md border border-border bg-surface p-3 sm:mt-2.5 sm:p-3.5">
          <PipelineStepper stats={stats} />
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
            <span className="truncate text-[11px] text-faint">Applied → Screening → Interview → Offer → Hired</span>
            <span className="shrink-0 font-data text-[11px] text-muted">
              <DisplayNumber value={stats?.totalCandidates ?? 0} /> total
            </span>
          </div>
        </div>
      </section>

      {/* Needs Review | Upcoming Interviews */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:gap-3">
        <div id="needs-review-section" className="min-w-0">
          <NeedsReviewCard items={candidatesRequiringReview} />
        </div>
        <div id="interviews-section" className="min-w-0">
          <UpcomingInterviews items={upcomingInterviews} />
        </div>
      </div>

      {/* AI Recommendations | Recent Activity */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:gap-3">
        <div className="min-w-0">
          <AiRecommendations items={aiRecommendedCandidates} />
        </div>
        <div className="min-w-0">
          <RecentActivity items={recentActivity} />
        </div>
      </div>

      {/* Talent Pools */}
      <div className="min-w-0">
        <TalentPoolsSummary items={topTalentPools} />
      </div>

      {/* Recent Uploads */}
      {(showInitialSkeleton || candidates.length > 0) && (
        <motion.div variants={itemVariants} className="min-w-0">
          <PanelHeader
            title="Recent Uploads"
            description={
              candidates.length > 0
                ? `${candidates.length} candidate${candidates.length === 1 ? "" : "s"} in your pipeline`
                : "Start receiving candidates"
            }
            className="mb-2"
            action={
              candidates.length > 0 ? (
                <Link href={effectiveSession?.sessionId ? `${ROUTES.candidates}?session=${effectiveSession.sessionId}` : ROUTES.candidates}>
                  <Button size="sm" className="h-7 bg-ink text-canvas hover:bg-ink/90 hover:text-canvas text-[12px]">
                    View All
                    <ArrowUpRight className="size-3.5 transition-transform duration-120 group-hover/button:translate-x-px group-hover/button:-translate-y-px" />
                  </Button>
                </Link>
              ) : undefined
            }
          />

          {showInitialSkeleton || (isValidating && !candidates.length) ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-md border border-border bg-surface p-3">
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-36" />
                      <Skeleton className="h-2.5 w-24" />
                    </div>
                    <Skeleton className="h-6 w-14" />
                  </div>
                </div>
              ))}
            </div>
          ) : candidates.length === 0 ? (
            <div className="rounded-md border border-border bg-surface p-6">
              <div className="mx-auto flex max-w-xs flex-col items-center text-center">
                <div className="mb-3 flex size-9 items-center justify-center rounded-md bg-surface-secondary">
                  <Users className="size-4 text-faint" strokeWidth={1.5} />
                </div>
                <h3 className="mb-0.5 text-[13px] font-medium text-ink">No candidates yet</h3>
                <p className="mb-3 text-[12px] leading-relaxed text-muted">
                  Upload a resume or create an application link above to start receiving candidates.
                </p>
                <div className="flex flex-col gap-2 min-[420px]:flex-row">
                  <Button size="sm" className="h-8 text-[12.5px]" onClick={focusWorkspace}>
                    <FilePlus className="size-3.5" />
                    Paste Job Description
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-[12.5px]" onClick={handleNewSession}>
                    <Plus className="size-3.5" />
                    Create Session
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {candidates.slice(0, 5).map((candidate) => (
                <CandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  onSelect={handleSelectCandidate}
                />
              ))}
            </div>
          )}
        </motion.div>
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
    </motion.div>
  )
}
