"use client"

import { useState, useCallback, useRef, useMemo, memo } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  Sparkles, Link2, RefreshCw, Loader2, ShieldAlert, Plus,
  FilePlus, Copy, Users, Briefcase,
  BadgeCheck, ArrowUpRight, Clock, Bot,
  ChevronRight,
} from "lucide-react"
import { toast } from "sonner"
import { CandidateDetailModal } from "@/components/candidate-detail-modal"
import { useApi } from "@/hooks/use-api"
import { useDashboard } from "@/hooks/use-dashboard"
import { useWebSocket } from "@/lib/use-websocket"
import { ROUTES, getInitials } from "@/lib/constants"
import type { SessionStats } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusDot } from "@/components/ui/status-dot"
import { PageHeader } from "@/components/ui/page-header"
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



function DisplayNumber({ value }: { value: number }) {
  return <span className="font-data">{value.toLocaleString()}</span>
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const } },
}

function statCards(stats: SessionStats | null) {
  return [
    {
      href: ROUTES.candidates,
      label: "Total Candidates",
      value: stats?.totalCandidates ?? 0,
      icon: Users,
    },
    {
      href: ROUTES.candidates,
      label: "Uploaded Today",
      value: stats?.uploadedToday ?? 0,
      icon: Clock,
    },
    {
      href: ROUTES.candidates,
      label: "In Progress",
      value: stats?.open ?? 0,
      icon: Briefcase,
      sub: `${stats?.applied ?? 0} applied · ${stats?.screening ?? 0} screening · ${stats?.interview ?? 0} interview`,
    },
    {
      href: `${ROUTES.candidates}?status=hired,offer`,
      label: "Hired",
      value: (stats?.hired ?? 0) + (stats?.offered ?? 0),
      icon: BadgeCheck,
      sub: `${stats?.hired ?? 0} hired · ${stats?.offered ?? 0} pending`,
    },
  ]
}

const CandidateCard = memo(function CandidateCard({
  candidate,
  onSelect,
  index,
}: {
  candidate: CandidateRow
  onSelect: (c: CandidateRow) => void
  index: number
}) {
  return (
    <motion.div
      variants={itemVariants}
      transition={{ delay: index * 0.03 }}
      className="cursor-pointer overflow-hidden rounded-lg border border-border bg-surface transition-all duration-120 hover:border-border-hover"
      onClick={() => onSelect(candidate)}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="size-9 shrink-0">
            <AvatarFallback className="text-[12px] font-medium">
              {getInitials(candidate.full_name)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[14px] font-medium text-ink">
              {candidate.full_name || "Unknown"}
            </h3>

            <p className="mt-0.5 truncate text-[12px] text-muted">
              {candidate.current_title || ""}
              {candidate.current_title && candidate.current_company ? " · " : ""}
              {candidate.current_company || ""}
            </p>

            {(candidate.skills || []).length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {(candidate.skills || []).slice(0, 3).map((skill, j) => (
                  <span
                    key={j}
                    className="rounded-md bg-surface-secondary px-2 py-0.5 text-[11px] text-muted"
                  >
                    {skill}
                  </span>
                ))}
                {(candidate.skills?.length || 0) > 3 && (
                  <span className="text-[11px] text-faint">
                    +{(candidate.skills?.length || 0) - 3}
                  </span>
                )}
              </div>
            )}

            <div className="mt-2 flex items-center gap-3">
              {candidate.total_experience_years != null && (
                <span className="text-[11px] text-faint">
                  <span className="font-data text-muted">{candidate.total_experience_years}y</span>
                </span>
              )}
              {candidate.location && (
                <span className="truncate text-[11px] text-faint">{candidate.location}</span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <div className="h-1 w-14 overflow-hidden rounded-full bg-track">
                <div
                  className="h-full rounded-full bg-info"
                  style={{ width: `${Math.round(candidate.match_score ?? 0)}%` }}
                />
              </div>
              <span className="font-data text-[11px] font-medium text-ink">
                {candidate.match_score !== undefined ? `${Math.round(candidate.match_score)}%` : "\u2014"}
              </span>
            </div>
            <div className="flex items-center">
              <StatusDot status={candidate.current_status || candidate.status || "Applied"} />
              <span className="text-[12px] text-muted">
                {candidate.current_status || candidate.status || "Applied"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
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
  const [biasResult, setBiasResult] = useState<{ has_bias: boolean; issues: BiasIssue[]; suggestions: string[] } | null>(null)
  const [, setBiasError] = useState("")
  const [page] = useState(1)
  const wsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [userClearedSession, setUserClearedSession] = useState(false)

  const api = useApi()
  const {
    data, stats, candidates, sessions: sessList, isLoading, isValidating, mutate,
    candidatesRequiringReview, aiRecommendedCandidates, upcomingInterviews,
    recentActivity, topTalentPools, quickActions,
  } = useDashboard(page, 50)

  const defaultSession = useMemo(() => {
    if (!data || userClearedSession) return null
    const latestSession = sessList?.[0]
    if (latestSession) {
      return { sessionId: latestSession.id, link: `/upload/${latestSession.id}` }
    }
    return null
  }, [data, sessList, userClearedSession])

  const effectiveSession = session ?? defaultSession

  useWebSocket('candidate:status_changed', useCallback(() => {
    if (wsDebounceRef.current) clearTimeout(wsDebounceRef.current)
    wsDebounceRef.current = setTimeout(() => mutate(), 500)
  }, [mutate]))

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
    const url = typeof window !== "undefined"
      ? `${window.location.origin}${effectiveSession?.link}`
      : effectiveSession?.link || ""
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
      const el = document.querySelector("textarea")
      if (el) el.focus()
      el?.scrollIntoView({ behavior: "smooth" })
    } else if (action === "scroll-to-needs-review") {
      document.getElementById("needs-review-section")?.scrollIntoView({ behavior: "smooth" })
    } else if (action === "scroll-to-interviews") {
      document.getElementById("interviews-section")?.scrollIntoView({ behavior: "smooth" })
    } else if (action === "navigate-offers") {
      window.location.href = `${ROUTES.candidates}?status=offered`
    }
  }, [])

  const statsList = statCards(stats)

  if (isLoading && !data) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-[10px] bg-info flex items-center justify-center">
            <Sparkles className="h-[18px] w-[18px] text-white" />
          </div>
          <div className="space-y-2 text-center">
            <div className="h-2.5 w-28 bg-border rounded-full animate-pulse-soft mx-auto" />
            <div className="h-2 w-20 bg-border rounded-full animate-pulse-soft mx-auto" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      <PageHeader
        title="AI Hiring Workspace"
        description="Generate application links, monitor your pipeline, and act on AI insights."
        actions={
          effectiveSession ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => mutate()}
              disabled={isValidating}
            >
              <RefreshCw className={`size-3.5 ${isValidating ? "animate-spin" : ""}`} strokeWidth={1.5} />
              Refresh
            </Button>
          ) : undefined
        }
      />

      {/* AI Hiring Workspace */}
      <motion.div variants={itemVariants}>
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-soft text-muted">
                <Bot className="size-[18px]" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-[13px] font-medium text-ink">Create a hiring session</p>
                <p className="text-[12px] text-muted mt-0.5">
                  Paste a job description to generate an AI-powered application link
                </p>
              </div>
            </div>
            {quickActions.length > 0 && (
              <QuickActions items={quickActions} onAction={handleQuickAction} />
            )}
          </div>

          <div className="p-5">
            <Textarea
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder="Paste the full job description here..."
              className="w-full"
            />

            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertDescription className="text-[13px]">{error}</AlertDescription>
              </Alert>
            )}

            {biasResult && biasResult.has_bias && (
              <Alert variant="warning" className="mt-4">
                <ShieldAlert className="h-3.5 w-3.5" />
                <AlertDescription>
                  <p className="text-[13px] font-medium mb-1.5">{biasResult.issues.length} bias issue(s) found</p>
                  {biasResult.issues.slice(0, 2).map((issue, i) => (
                    <p key={i} className="text-[12px] mb-1">[{issue.category}] {issue.suggestion}</p>
                  ))}
                </AlertDescription>
              </Alert>
            )}

            {biasResult && !biasResult.has_bias && (
              <Alert variant="success" className="mt-4">
                <ShieldAlert className="h-3.5 w-3.5" />
                <AlertDescription className="text-[13px] font-medium">
                  No bias detected — JD looks great!
                </AlertDescription>
              </Alert>
            )}

            <div className="mt-4 flex items-center justify-between">
              <div />
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleBiasScan} disabled={scanningBias || !jdText.trim()}>
                  {scanningBias ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <ShieldAlert className="size-3.5" />
                  )}
                  {scanningBias ? "Scanning..." : "Check Bias"}
                </Button>
                <Button size="sm" onClick={generateLink} disabled={generating || !jdText.trim()}>
                  {generating ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5" />
                  )}
                  {generating ? "Generating..." : "Generate Link"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Active Application Link */}
      {effectiveSession && (
        <motion.div variants={itemVariants}>
          <div className="bg-surface border border-border rounded-xl flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <Link2 className="size-4 text-info" strokeWidth={1.5} />
              <div>
                <p className="text-[11px] font-medium text-faint uppercase" style={{ letterSpacing: "0.05em", fontFamily: "var(--font-inter)" }}>
                  Active Application Link
                </p>
                <p className="text-[13px] text-ink font-data mt-0.5">
                  {typeof window !== "undefined"
                    ? `${window.location.origin}${effectiveSession.link}`
                    : effectiveSession.link}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink transition-all duration-120"
                style={{ fontFamily: "var(--font-inter)" }}
              >
                <Copy className="size-3.5" strokeWidth={1.5} />
                {copied ? "Copied" : "Copy"}
              </button>
              <Button variant="outline" size="sm" onClick={handleNewSession}>
                <Plus className="size-3.5" />
                New Session
              </Button>
            </div>
          </div>
        <div className="rounded-lg border border-border bg-surface">
            <div className="flex items-center justify-between gap-3 px-5 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <Link2 className="size-4 shrink-0 text-info" strokeWidth={1.5} />
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-faint">
                    Active Application Link
                  </p>
                  <p className="truncate font-data text-[13px] text-ink mt-0.5">
                    {typeof window !== "undefined"
                      ? `${window.location.origin}${effectiveSession.link}`
                      : effectiveSession.link}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink transition-all duration-120"
                >
                  <Copy className="size-3.5" strokeWidth={1.5} />
                  {copied ? "Copied" : "Copy"}
                </button>
                <Button variant="outline" size="sm" onClick={handleNewSession}>
                  <Plus className="size-3.5" />
                  New Session
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Pipeline Metrics */}
      <section id="pipeline-metrics">
        <PanelHeader
          title="Pipeline Metrics"
          description="Candidate volume across your pipeline"
          className="mb-3"
          action={
            <Link
              href={ROUTES.candidates}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-muted transition-colors duration-120 hover:text-ink"
            >
              View all
              <ChevronRight className="size-3.5" strokeWidth={1.5} />
            </Link>
          }
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {statsList.map((card, i) => (
            <motion.div key={card.label} variants={itemVariants} transition={{ delay: i * 0.05 }}>
              <Link href={card.href}>
                <div className="rounded-lg border border-border bg-surface p-5 transition-all duration-120 hover:border-border-hover">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-faint">
                      {card.label}
                    </span>
                    <card.icon className="size-4 text-faint" strokeWidth={1.5} />
                  </div>
                  <p className="mt-3 font-data text-[28px] font-medium leading-none text-ink">
                    <DisplayNumber value={card.value} />
                  </p>
                  {card.sub && <p className="mt-2 text-[11px] text-faint">{card.sub}</p>}
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Needs Review | Upcoming Interviews */}
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-4">
        <div id="needs-review-section">
          <NeedsReviewCard items={candidatesRequiringReview} />
        </div>
        <div id="interviews-section">
          <UpcomingInterviews items={upcomingInterviews} />
        </div>
      </div>

      {/* AI Recommendations | Recent Activity */}
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-4">
        <AiRecommendations items={aiRecommendedCandidates} />
        <RecentActivity items={recentActivity} />
      </div>

      {/* Talent Pools */}
      <TalentPoolsSummary items={topTalentPools} />

      {/* Recent Uploads */}
      {candidates.length > 0 && (
        <motion.div variants={itemVariants}>
          <PanelHeader
            title="Recent Uploads"
            description={
              candidates.length > 0
                ? `${candidates.length} candidate${candidates.length === 1 ? "" : "s"} in your pipeline`
                : "Start receiving candidates"
            }
            className="mb-3"
            action={
              candidates.length > 0 ? (
                <Link href={`${ROUTES.candidates}?session=${effectiveSession?.sessionId}`}>
                  <Button variant="outline" size="sm">
                    View All
                    <ArrowUpRight className="size-3.5" />
                  </Button>
                </Link>
              ) : undefined
            }
          />

          {isValidating && !candidates.length ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-border bg-surface p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-40" />
                      <Skeleton className="h-3 w-28" />
                      <div className="flex gap-1.5">
                        <Skeleton className="h-5 w-14 rounded-md" />
                        <Skeleton className="h-5 w-16 rounded-md" />
                        <Skeleton className="h-5 w-12 rounded-md" />
                      </div>
                    </div>
                    <Skeleton className="h-7 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : candidates.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface p-10">
              <div className="mx-auto flex max-w-sm flex-col items-center text-center">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-surface-secondary">
                  <Users className="h-5 w-5 text-faint" strokeWidth={1.5} />
                </div>
                <h3 className="mb-1 text-[14px] font-medium text-ink">No candidates yet</h3>
                <p className="mb-5 text-[13px] leading-relaxed text-muted">
                  Upload a resume or create an application link above to start receiving candidates.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => { const el = document.querySelector('textarea'); if (el) el.focus() }}>
                    <FilePlus className="size-3.5" />
                    Paste Job Description
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleNewSession}>
                    <Plus className="size-3.5" />
                    Create Session
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {candidates.slice(0, 5).map((candidate, index) => (
                <CandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  onSelect={handleSelectCandidate}
                  index={index}
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
