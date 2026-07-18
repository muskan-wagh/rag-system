"use client"

import { Suspense, useState, useEffect, useCallback, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import {
  Users, FileText, ChevronLeft, ChevronRight,
  BadgeCheck, Loader2, Search, Sparkles, Eye,
  Briefcase, Calendar, Clock, GraduationCap,
  ChevronDown, MoreHorizontal, Download, Plus,
  Brain, Target, AlertTriangle, TrendingUp,
  CheckCircle2, XCircle, Clock as ClockIcon,
  ArrowUpRight,
} from "lucide-react"
import { toast } from "sonner"
import { CandidateDetailModal } from "@/components/candidate-detail-modal"
import { useApi } from "@/hooks/use-api"
import { useWebSocket } from "@/lib/use-websocket"
import { ROUTES, getStatusColor, getInitials, formatDate, getFlightRiskColor, CANDIDATE_STATUS } from "@/lib/constants"
import type { SessionSummary, CandidateRecord, CandidatesPageData } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { Dialog, DialogContent } from "@/components/ui/dialog"

const PAGE_SIZE = 20

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } },
}

function StatusBadge({ status }: { status?: string }) {
  const statusConfig: Record<string, { icon: typeof CheckCircle2; color: string; bg: string; border: string }> = {
    hired: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
    offered: { icon: ClockIcon, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
    rejected: { icon: XCircle, color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
    screening: { icon: Search, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
    interview: { icon: Calendar, color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200" },
    applied: { icon: Clock, color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200" },
  }
  const key = (status || "applied").toLowerCase()
  const config = statusConfig[key] || statusConfig.applied
  const Icon = config.icon

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${config.bg} ${config.border} ${config.color}`}>
      <Icon className="h-3 w-3" />
      {status || "Applied"}
    </span>
  )
}

function SkillPill({ skill, index }: { skill: string; index: number }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-gradient-to-r from-primary/[0.06] to-emerald-400/[0.04] text-primary border border-primary/5 whitespace-nowrap">
      {skill}
    </span>
  )
}

function AiScoreRing({ score }: { score?: number }) {
  const value = score ?? 0
  const radius = 18
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  const color = value >= 80 ? "#10B981" : value >= 60 ? "#0D9488" : value >= 40 ? "#F59E0B" : "#EF4444"
  const label = value >= 80 ? "Excellent" : value >= 60 ? "Strong" : value >= 40 ? "Fair" : "Low"

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex items-center justify-center">
        <svg width="44" height="44" className="-rotate-90">
          <circle cx="22" cy="22" r={radius} fill="none" stroke="#E2E8F0" strokeWidth="3" />
          <circle
            cx="22" cy="22" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700"
          />
        </svg>
        <span className="absolute text-[10px] font-bold tabular-nums">{Math.round(value)}</span>
      </div>
      <div className="hidden lg:block">
        <p className="text-xs font-semibold text-foreground" style={{ color }}>{label}</p>
        <p className="text-[10px] text-muted-foreground">AI Match</p>
      </div>
    </div>
  )
}

function CandidatesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [sessionsLoading, setSessionsLoading] = useState(true)

  const [candidatesData, setCandidatesData] = useState<CandidatesPageData | null>(null)
  const [candidatesLoading, setCandidatesLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(1)

  const [selectedCandidate, setSelectedCandidate] = useState<CandidateRecord | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showHireConfirm, setShowHireConfirm] = useState(false)
  const [hireCandidate, setHireCandidate] = useState<CandidateRecord | null>(null)
  const [hireLoading, setHireLoading] = useState(false)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const statusFilterParam = searchParams.get("status") as string | null

  const statusTabs = [
    { label: "All", value: null },
    { label: "Hired", value: "hired" },
    { label: "Pending Offers", value: "offer" },
    { label: "Rejected", value: "rejected" },
  ] as const

  const api = useApi()

  const loadCandidatesPage = useCallback(async (sessionId: string | null, query: string, currentPage: number, statusFilter?: string | null) => {
    setCandidatesLoading(true)
    setSessionsLoading(true)
    try {
      const res = await api.getCandidatesPage({
        page: currentPage,
        limit: PAGE_SIZE,
        search: query || undefined,
        sessionId: sessionId || undefined,
        sortBy: "created_at",
        sortOrder: "desc",
        status: statusFilter || undefined,
      })
      if (res.success && res.data) {
        setSessions(res.data.sessions)
        setCandidatesData(res.data)
      }
    } catch {
      toast.error("Failed to load candidates")
    } finally {
      setCandidatesLoading(false)
      setSessionsLoading(false)
    }
  }, [])

  useEffect(() => {
    async function init() {
      const sessionFromUrl = searchParams.get("session")
      if (sessionFromUrl) {
        setSelectedSessionId(sessionFromUrl)
      }
    }
    init()
  }, [searchParams])

  useEffect(() => {
    async function init() {
      await loadCandidatesPage(selectedSessionId, searchQuery, page, statusFilterParam)
    }
    init()
  }, [selectedSessionId, searchQuery, page, statusFilterParam, loadCandidatesPage])

  const handleWebSocketUpdate = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      loadCandidatesPage(selectedSessionId, searchQuery, page, statusFilterParam)
    }, 500)
  }, [selectedSessionId, searchQuery, page, statusFilterParam, loadCandidatesPage])

  useWebSocket("candidate:status_changed", handleWebSocketUpdate)

  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value)
    setPage(1)
  }, [])

  const handleSelectSession = useCallback((sessionId: string | null) => {
    setSelectedSessionId(sessionId)
    setSearchQuery("")
    setPage(1)
  }, [])

  const handleViewCandidate = useCallback((candidate: CandidateRecord) => {
    setSelectedCandidate(candidate)
    setShowDetailModal(true)
  }, [])

  const handleHireClick = useCallback((candidate: CandidateRecord) => {
    setHireCandidate(candidate)
    setShowHireConfirm(true)
  }, [])

  const confirmHire = async () => {
    if (!hireCandidate) return
    setHireLoading(true)
    try {
      const res = await api.markCandidateAsHired(hireCandidate.id)
      if (res.success) {
        toast.success("Candidate marked as Hired!")
        setShowHireConfirm(false)
        setHireCandidate(null)
        loadCandidatesPage(selectedSessionId, searchQuery, page, statusFilterParam)
      } else {
        toast.error(res.error || "Failed to mark candidate as hired")
      }
    } catch {
      toast.error("Failed to mark candidate as hired")
    } finally {
      setHireLoading(false)
    }
  }

  const handleStatusTabClick = (value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set("status", value)
    } else {
      params.delete("status")
    }
    const qs = params.toString()
    router.push(`${ROUTES.candidates}${qs ? `?${qs}` : ""}`)
  }

  const totalPages = candidatesData?.totalPages || 0
  const startRow = candidatesData?.total ? (page - 1) * PAGE_SIZE + 1 : 0
  const endRow = Math.min(page * PAGE_SIZE, candidatesData?.total || 0)

  const avgMatchScore = candidatesData?.candidates.length
    ? Math.round(candidatesData.candidates.reduce((s, c) => s + (c.match_score ?? 0), 0) / candidatesData.candidates.length)
    : 0

  const pendingInterviews = candidatesData?.candidates.filter(
    c => c.current_status?.toLowerCase() === "interview"
  ).length ?? 0

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="p-6 lg:p-8 xl:p-10 max-w-[1440px] mx-auto"
    >
      {/* Header with metrics */}
      <motion.div variants={itemVariants} className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center shadow-md shadow-primary/20">
              <Users className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Candidate Database</h1>
              <p className="text-sm text-muted-foreground">
                {selectedSessionId ? "Filtered by hiring session" : `All candidates across all sessions`}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-3 px-4 py-2 rounded-xl bg-white/60 border border-border/40">
            <div className="text-center">
              <p className="text-lg font-bold text-foreground tabular-nums">{candidatesData?.total ?? 0}</p>
              <p className="text-[10px] text-muted-foreground whitespace-nowrap">Total</p>
            </div>
            <div className="w-px h-8 bg-border/40" />
            <div className="text-center">
              <p className="text-lg font-bold text-primary tabular-nums">{avgMatchScore}%</p>
              <p className="text-[10px] text-muted-foreground whitespace-nowrap">Avg Match</p>
            </div>
            <div className="w-px h-8 bg-border/40" />
            <div className="text-center">
              <p className="text-lg font-bold text-amber-500 tabular-nums">{pendingInterviews}</p>
              <p className="text-[10px] text-muted-foreground whitespace-nowrap">Interviews</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl border-border/60 h-9 px-3 text-xs hidden md:inline-flex"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export
            </Button>
            <Button
              size="sm"
              className="rounded-xl bg-gradient-to-r from-primary to-emerald-500 text-white shadow-lg shadow-primary/20 hover:shadow-xl transition-all h-9 px-4"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add Candidate
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Sessions bar */}
      <motion.div variants={itemVariants} className="mb-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => handleSelectSession(null)}
            className={`shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all border ${
              selectedSessionId === null
                ? "bg-gradient-to-r from-primary/10 to-emerald-400/5 border-primary/10 text-primary shadow-sm"
                : "bg-white/50 border-border/40 text-muted-foreground hover:text-foreground hover:border-border/60 hover:bg-white/80"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            All Candidates
          </button>
          {sessionsLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-32 rounded-xl shrink-0" />
            ))
          ) : sessions.length === 0 ? (
            <span className="text-xs text-muted-foreground px-2">No sessions yet</span>
          ) : (
            sessions.map((session) => {
              const truncatedText = session.job_description_text
                ? session.job_description_text.length > 40
                  ? session.job_description_text.slice(0, 40) + "..."
                  : session.job_description_text
                : "Untitled Session"
              return (
                <button
                  key={session.id}
                  onClick={() => handleSelectSession(session.id)}
                  className={`shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all border whitespace-nowrap ${
                    selectedSessionId === session.id
                      ? "bg-gradient-to-r from-primary/10 to-emerald-400/5 border-primary/10 text-primary shadow-sm"
                      : "bg-white/50 border-border/40 text-muted-foreground hover:text-foreground hover:border-border/60 hover:bg-white/80"
                  }`}
                >
                  <Briefcase className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate max-w-[150px]">{truncatedText}</span>
                  <span className="text-[10px] text-muted-foreground/60 ml-auto tabular-nums">({session.candidate_count})</span>
                </button>
              )
            })
          )}
        </div>
      </motion.div>

      {/* Filters bar */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          {statusTabs.map((tab) => {
            const isActive = tab.value === null
              ? !statusFilterParam
              : statusFilterParam === tab.value || statusFilterParam?.split(",").includes(tab.value || "")
            return (
              <button
                key={tab.label}
                onClick={() => handleStatusTabClick(tab.value)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  isActive
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/60"
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by name, email, or company..."
              className="w-full sm:w-64 h-9 rounded-xl border border-border/60 bg-white/50 pl-9 pr-10 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all backdrop-blur-sm"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searchQuery && (
                <button
                  onClick={() => handleSearch("")}
                  className="h-4 w-4 rounded flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </button>
              )}
              {!searchQuery && (
                <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-white/40 border border-border/40 text-[9px] text-muted-foreground/50 font-mono">
                  <span className="text-[8px]">⌘</span>K
                </kbd>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main content grid */}
      <div className="flex gap-8">
        {/* Candidate list */}
        <div className="flex-1 min-w-0">
          {candidatesLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <motion.div
                  key={i}
                  variants={itemVariants}
                  className="glass-card rounded-2xl p-5 border border-white/50"
                >
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-11 w-11 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-44 rounded-md" />
                      <Skeleton className="h-3 w-28 rounded-md" />
                    </div>
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-8 w-20 rounded-lg" />
                  </div>
                </motion.div>
              ))}
            </div>
          ) : candidatesData?.candidates.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 md:p-16 border border-white/50">
              <div className="flex flex-col items-center text-center max-w-sm mx-auto">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/5 to-emerald-400/5 border border-primary/5 flex items-center justify-center mb-5">
                  <Users className="h-7 w-7 text-primary/40" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1.5">
                  {searchQuery ? "No candidates found" : "No candidates yet"}
                </h3>
                <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                  {searchQuery
                    ? "Try a different search term or clear filters"
                    : "Upload resumes or create an application link to start building your candidate database."}
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    size="sm"
                    className="rounded-xl bg-gradient-to-r from-primary to-emerald-500 text-white shadow-lg shadow-primary/20 hover:shadow-xl transition-all"
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Upload Resume
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(ROUTES.dashboard)}
                    className="rounded-xl border-border/60"
                  >
                    <ArrowUpRight className="h-4 w-4 mr-1.5" />
                    Go to Dashboard
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {candidatesData?.candidates.map((candidate, i) => (
                  <motion.div
                    key={candidate.id}
                    variants={itemVariants}
                    transition={{ delay: i * 0.02 }}
                    className="group glass-card rounded-2xl p-5 border border-white/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
                    onClick={() => handleViewCandidate(candidate)}
                  >
                    <div className="flex items-start gap-4">
                      <Avatar className="h-11 w-11 ring-2 ring-white shadow-sm shrink-0">
                        <AvatarFallback className="text-xs font-semibold bg-gradient-to-br from-primary/10 to-emerald-400/10 text-primary">
                          {getInitials(candidate.full_name)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-semibold text-foreground">
                            {candidate.full_name || "Unknown"}
                          </p>
                          {candidate.match_score !== undefined && candidate.match_score >= 85 && (
                            <Sparkles className="h-3 w-3 text-amber-500" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {candidate.current_title || ""}
                          {candidate.current_title && candidate.current_company ? " @ " : ""}
                          {candidate.current_company && (
                            <span className="font-medium text-foreground/60">{candidate.current_company}</span>
                          )}
                          {!candidate.current_title && !candidate.current_company && "—"}
                        </p>

                        <div className="flex flex-wrap items-center gap-2 mt-3">
                          {(candidate.skills || []).slice(0, 4).map((skill, j) => (
                            <SkillPill key={j} skill={skill} index={j} />
                          ))}
                          {(candidate.skills?.length || 0) > 4 && (
                            <span className="text-[10px] text-muted-foreground font-medium px-2 py-1 rounded-full bg-white/40 border border-border/30">
                              +{(candidate.skills?.length || 0) - 4} more
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 mt-3">
                          {candidate.total_experience_years != null && (
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Briefcase className="h-3 w-3" />
                              {candidate.total_experience_years}y exp
                            </div>
                          )}
                          {candidate.location && (
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              {candidate.location}
                            </div>
                          )}
                          <StatusBadge status={candidate.current_status} />
                          {candidate.flight_risk && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                              candidate.flight_risk === "High"
                                ? "bg-red-50 border-red-200 text-red-600"
                                : candidate.flight_risk === "Medium"
                                ? "bg-amber-50 border-amber-200 text-amber-600"
                                : "bg-emerald-50 border-emerald-200 text-emerald-600"
                            }`}>
                              {candidate.flight_risk} risk
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <AiScoreRing score={candidate.match_score} />
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {candidate.resume_file_url && (
                            <a
                              href={candidate.resume_file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white/60 transition-colors text-muted-foreground hover:text-foreground"
                              title="View Resume"
                            >
                              <FileText className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {candidate.current_status === CANDIDATE_STATUS.OFFERED && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleHireClick(candidate) }}
                              className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-emerald-50 transition-colors text-emerald-500"
                              title="Mark as Hired"
                            >
                              <BadgeCheck className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleViewCandidate(candidate) }}
                            className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-primary/5 transition-colors text-primary"
                            title="View Details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 px-1">
                  <p className="text-xs text-muted-foreground">
                    Showing {startRow}–{endRow} of {candidatesData?.total} candidates
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/40 bg-white/50 text-muted-foreground hover:text-foreground hover:bg-white/80 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      let pageNum: number
                      if (totalPages <= 5) {
                        pageNum = i + 1
                      } else if (page <= 3) {
                        pageNum = i + 1
                      } else if (page >= totalPages - 2) {
                        pageNum = totalPages - 4 + i
                      } else {
                        pageNum = page - 2 + i
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition-all ${
                            pageNum === page
                              ? "bg-primary text-white shadow-sm"
                              : "border border-border/40 bg-white/50 text-muted-foreground hover:text-foreground hover:bg-white/80"
                          }`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/40 bg-white/50 text-muted-foreground hover:text-foreground hover:bg-white/80 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* AI Insights Panel (sticky, right side) */}
        {candidatesData && candidatesData.candidates.length > 0 && (
          <div className="hidden xl:block w-72 shrink-0">
            <div className="sticky top-24 space-y-4">
              <div className="glass-card rounded-2xl p-5 border border-white/50">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary/10 to-emerald-400/10 border border-primary/5 flex items-center justify-center">
                    <Brain className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">AI Insights</h3>
                </div>

                <div className="space-y-4">
                  <div className="bg-white/50 rounded-xl p-3.5 border border-white/40">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Top Candidate</span>
                      <Sparkles className="h-3 w-3 text-amber-500" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      {candidatesData.candidates.reduce((best, c) =>
                        (c.match_score ?? 0) > (best.match_score ?? 0) ? c : best
                      ).full_name || "N/A"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Match: {Math.max(...candidatesData.candidates.map(c => c.match_score ?? 0))}%
                    </p>
                  </div>

                  <div className="bg-white/50 rounded-xl p-3.5 border border-white/40">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Hiring Risk</span>
                      <AlertTriangle className="h-3 w-3 text-amber-500" />
                    </div>
                    <p className="text-xs text-foreground/80">
                      {candidatesData.candidates.filter(c => c.flight_risk === "High").length > 0
                        ? `${candidatesData.candidates.filter(c => c.flight_risk === "High").length} candidate(s) have high flight risk`
                        : "No high risk candidates detected"}
                    </p>
                  </div>

                  <div className="bg-white/50 rounded-xl p-3.5 border border-white/40">
                    <div className="flex items-center gap-1 mb-1">
                      <Target className="h-3 w-3 text-primary" />
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Avg Match</span>
                    </div>
                    <p className="text-lg font-bold text-primary tabular-nums">{avgMatchScore}%</p>
                    <div className="mt-2 h-1.5 bg-white/60 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-primary to-emerald-400 rounded-full" style={{ width: `${avgMatchScore}%` }} />
                    </div>
                  </div>

                  <div className="bg-white/50 rounded-xl p-3.5 border border-white/40">
                    <div className="flex items-center gap-1 mb-2">
                      <GraduationCap className="h-3 w-3 text-primary" />
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Pipeline</span>
                    </div>
                    <div className="space-y-1.5">
                      {[
                        { label: "Applied", count: candidatesData.candidates.filter(c => c.current_status?.toLowerCase() === "applied" || !c.current_status).length, color: "bg-slate-400" },
                        { label: "Screening", count: candidatesData.candidates.filter(c => c.current_status?.toLowerCase() === "screening").length, color: "bg-amber-400" },
                        { label: "Interview", count: pendingInterviews, color: "bg-violet-400" },
                        { label: "Offered", count: candidatesData.candidates.filter(c => c.current_status?.toLowerCase() === "offered").length, color: "bg-blue-400" },
                        { label: "Hired", count: candidatesData.candidates.filter(c => c.current_status?.toLowerCase() === "hired").length, color: "bg-emerald-400" },
                        { label: "Rejected", count: candidatesData.candidates.filter(c => c.current_status?.toLowerCase() === "rejected").length, color: "bg-red-400" },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${item.color}`} />
                            <span className="text-[10px] text-muted-foreground">{item.label}</span>
                          </div>
                          <span className="text-[10px] font-semibold text-foreground tabular-nums">{item.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push(ROUTES.candidateSearch)}
                className="w-full rounded-xl border-border/60 h-9 text-xs"
              >
                <Search className="h-3.5 w-3.5 mr-1.5" />
                AI-Powered Search
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Hire confirmation dialog */}
      <Dialog open={showHireConfirm} onOpenChange={(o) => { if (!o) { setShowHireConfirm(false); setHireCandidate(null) } }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <div className="px-6 pt-6 pb-2">
            <div className="flex items-center gap-2 text-emerald-600">
              <BadgeCheck className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Mark as Hired</h2>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Confirm that <strong>{hireCandidate?.full_name || "this candidate"}</strong> has been hired.
            </p>
          </div>
          <div className="px-6 pb-6 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setShowHireConfirm(false); setHireCandidate(null) }} disabled={hireLoading}>
              Cancel
            </Button>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={confirmHire} disabled={hireLoading}>
              {hireLoading && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Confirm Hired
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CandidateDetailModal
        open={showDetailModal}
        onClose={() => {
          setShowDetailModal(false)
          setSelectedCandidate(null)
        }}
        candidate={selectedCandidate || null}
        onStatusChange={() => loadCandidatesPage(selectedSessionId, searchQuery, page, statusFilterParam)}
      />
    </motion.div>
  )
}

export default function CandidatesPage() {
  return (
    <Suspense fallback={null}>
      <CandidatesContent />
    </Suspense>
  )
}
