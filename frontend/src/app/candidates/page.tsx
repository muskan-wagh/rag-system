"use client"

import { Suspense, useState, useEffect, useCallback, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import {
  Users, FileText, ChevronLeft, ChevronRight,
  BadgeCheck, Loader2, Search, Sparkles, Eye,
  Briefcase, Calendar, Clock, GraduationCap,
  Download, Plus, Brain, Target, AlertTriangle,
  CheckCircle2, XCircle, ArrowUpRight,
  User, MapPin, ChevronDown,
} from "lucide-react"
import { toast } from "sonner"
import { CandidateDetailModal } from "@/components/candidate-detail-modal"
import { useApi } from "@/hooks/use-api"
import { useWebSocket } from "@/lib/use-websocket"
import { ROUTES, getInitials } from "@/lib/constants"
import type { SessionSummary, CandidateRecord, CandidatesPageData } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { ProgressBar } from "@/components/ui/progress-bar"
import { GlassCard } from "@/components/ui/glass-card"

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

function statusConfig(status?: string) {
  const s = (status || "applied").toLowerCase()
  const configs: Record<string, { label: string; color: string; bg: string }> = {
    hired: { label: "Hired", color: "text-[#16A34A]", bg: "bg-[#16A34A]/10" },
    offered: { label: "Offered", color: "text-[#111111]", bg: "bg-[#111111]/5" },
    rejected: { label: "Rejected", color: "text-[#EF4444]", bg: "bg-[#EF4444]/10" },
    screening: { label: "Screening", color: "text-[#F59E0B]", bg: "bg-[#F59E0B]/10" },
    interview: { label: "Interview", color: "text-[#6B7280]", bg: "bg-[#F6F6F4]" },
    applied: { label: "Applied", color: "text-[#6B7280]", bg: "bg-[#F6F6F4]" },
  }
  return configs[s] || configs.applied
}

function getScoreColor(score?: number) {
  if (!score) return "#A3A3A3"
  if (score >= 80) return "#111111"
  if (score >= 60) return "#6B7280"
  if (score >= 40) return "#F59E0B"
  return "#EF4444"
}

function getScoreLabel(score?: number) {
  if (!score) return "—"
  if (score >= 80) return "Excellent"
  if (score >= 60) return "Strong"
  if (score >= 40) return "Fair"
  return "Low"
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
        page: currentPage, limit: PAGE_SIZE, search: query || undefined,
        sessionId: sessionId || undefined, sortBy: "created_at", sortOrder: "desc",
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
    const sessionFromUrl = searchParams.get("session")
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (sessionFromUrl) setSelectedSessionId(sessionFromUrl)
  }, [searchParams])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCandidatesPage(selectedSessionId, searchQuery, page, statusFilterParam)
  }, [selectedSessionId, searchQuery, page, statusFilterParam, loadCandidatesPage])

  const handleWebSocketUpdate = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => loadCandidatesPage(selectedSessionId, searchQuery, page, statusFilterParam), 500)
  }, [selectedSessionId, searchQuery, page, statusFilterParam, loadCandidatesPage])

  useWebSocket("candidate:status_changed", handleWebSocketUpdate)

  const handleSearch = useCallback((value: string) => { setSearchQuery(value); setPage(1) }, [])
  const handleSelectSession = useCallback((sessionId: string | null) => { setSelectedSessionId(sessionId); setSearchQuery(""); setPage(1) }, [])
  const handleViewCandidate = useCallback((candidate: CandidateRecord) => { setSelectedCandidate(candidate); setShowDetailModal(true) }, [])
  const handleHireClick = useCallback((candidate: CandidateRecord) => { setHireCandidate(candidate); setShowHireConfirm(true) }, [])

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
    if (value) params.set("status", value)
    else params.delete("status")
    router.push(`${ROUTES.candidates}${params.toString() ? `?${params.toString()}` : ""}`)
  }

  const totalPages = candidatesData?.totalPages || 0
  const startRow = candidatesData?.total ? (page - 1) * PAGE_SIZE + 1 : 0
  const endRow = Math.min(page * PAGE_SIZE, candidatesData?.total || 0)
  const avgMatchScore = candidatesData?.candidates.length
    ? Math.round(candidatesData.candidates.reduce((s, c) => s + (c.match_score ?? 0), 0) / candidatesData.candidates.length)
    : 0
  const pendingInterviews = candidatesData?.candidates.filter(c => c.current_status?.toLowerCase() === "interview").length ?? 0

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="pt-6 space-y-8"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-medium text-[#111111] tracking-tight">Candidates</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            {selectedSessionId ? "Filtered by hiring session" : "All candidates across all sessions"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4 px-4 py-2 rounded-full bg-white border border-[#ECECEC]">
            <div className="text-center">
              <p className="text-sm font-medium text-[#111111] tabular-nums">{candidatesData?.total ?? 0}</p>
              <p className="text-[10px] text-[#A3A3A3]">Total</p>
            </div>
            <div className="w-px h-6 bg-[#ECECEC]" />
            <div className="text-center">
              <p className="text-sm font-medium text-[#111111] tabular-nums">{avgMatchScore}%</p>
              <p className="text-[10px] text-[#A3A3A3]">Avg Match</p>
            </div>
            <div className="w-px h-6 bg-[#ECECEC]" />
            <div className="text-center">
              <p className="text-sm font-medium text-[#6B7280] tabular-nums">{pendingInterviews}</p>
              <p className="text-[10px] text-[#A3A3A3]">Interviews</p>
            </div>
          </div>
          <Button variant="outline" size="sm">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export
          </Button>
          <Button size="sm" className="bg-[#111111] text-white hover:bg-[#2A2A2A]">
            <Plus className="h-4 w-4 mr-1.5" />
            Add Candidate
          </Button>
        </div>
      </motion.div>

      {/* Sessions bar */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => handleSelectSession(null)}
            className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all border ${
              selectedSessionId === null
                ? "bg-[#111111] text-white border-[#111111]"
                : "bg-white border-[#ECECEC] text-[#6B7280] hover:text-[#111111] hover:border-[#D4D4D4]"
            }`}
          >
            <Users className="h-3.5 w-3.5" strokeWidth={1.5} />
            All Candidates
          </button>
          {sessionsLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-32 rounded-full shrink-0" />)
          ) : sessions.length === 0 ? (
            <span className="text-xs text-[#A3A3A3] px-2">No sessions yet</span>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => handleSelectSession(session.id)}
                className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all border whitespace-nowrap ${
                  selectedSessionId === session.id
                    ? "bg-[#111111] text-white border-[#111111]"
                    : "bg-white border-[#ECECEC] text-[#6B7280] hover:text-[#111111] hover:border-[#D4D4D4]"
                }`}
              >
                <Briefcase className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                <span className="truncate max-w-[150px]">
                  {session.job_description_text
                    ? session.job_description_text.length > 35
                      ? session.job_description_text.slice(0, 35) + "..."
                      : session.job_description_text
                    : "Untitled"}
                </span>
                <span className="text-[10px] opacity-60 ml-1 tabular-nums">({session.candidate_count})</span>
              </button>
            ))
          )}
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 bg-[#F6F6F4] rounded-full p-1">
          {statusTabs.map((tab) => {
            const isActive = tab.value === null ? !statusFilterParam : statusFilterParam === tab.value || statusFilterParam?.split(",").includes(tab.value || "")
            return (
              <button
                key={tab.label}
                onClick={() => handleStatusTabClick(tab.value)}
                className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all ${
                  isActive ? "bg-white text-[#111111] shadow-sm" : "text-[#6B7280] hover:text-[#111111]"
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#A3A3A3]" strokeWidth={1.5} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search candidates..."
            className="w-64 h-9 rounded-full border border-[#ECECEC] bg-white pl-9 pr-4 text-sm text-[#111111] placeholder:text-[#A3A3A3] outline-none focus:border-[#111111] focus:shadow-[0_0_0_3px_rgba(17,17,17,0.06)] transition-all"
          />
        </div>
      </motion.div>

      {/* Candidate Grid */}
      {candidatesLoading ? (
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-[24px] border border-[#ECECEC] p-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-14 w-14 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <div className="mt-4 space-y-2">
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-2 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : candidatesData?.candidates.length === 0 ? (
        <div className="bg-white rounded-[24px] border border-[#ECECEC] shadow-[0_10px_40px_rgba(0,0,0,0.05)] p-20">
          <div className="flex flex-col items-center text-center max-w-sm mx-auto">
            <div className="h-16 w-16 rounded-[20px] bg-[#F6F6F4] flex items-center justify-center mb-5">
              <Users className="h-7 w-7 text-[#A3A3A3]" strokeWidth={1.5} />
            </div>
            <h3 className="text-base font-medium text-[#111111] mb-1">
              {searchQuery ? "No candidates found" : "No candidates yet"}
            </h3>
            <p className="text-sm text-[#6B7280] mb-6 leading-relaxed">
              {searchQuery ? "Try a different search term or clear filters" : "Upload resumes or create an application link to start building your candidate database."}
            </p>
            <div className="flex gap-3">
              <Button size="sm" className="bg-[#111111] text-white hover:bg-[#2A2A2A]">
                <Plus className="h-4 w-4 mr-1.5" />
                Upload Resume
              </Button>
              <Button variant="outline" size="sm" onClick={() => router.push(ROUTES.dashboard)}>
                <ArrowUpRight className="h-4 w-4 mr-1.5" />
                Go to Dashboard
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            {candidatesData?.candidates.map((candidate, i) => (
              <motion.div
                key={candidate.id}
                variants={itemVariants}
                transition={{ delay: i * 0.02 }}
                className="group bg-white rounded-[24px] border border-[#ECECEC] shadow-[0_10px_40px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_60px_rgba(0,0,0,0.08)] hover:-translate-y-[6px] transition-all duration-300 cursor-pointer overflow-hidden"
                onClick={() => handleViewCandidate(candidate)}
              >
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="relative">
                      <Avatar className="h-14 w-14 ring-2 ring-white shadow-sm shrink-0">
                        <AvatarFallback className="text-base font-medium bg-[#F6F6F4] text-[#6B7280]">
                          {getInitials(candidate.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      {candidate.match_score !== undefined && candidate.match_score >= 85 && (
                        <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-white shadow-sm border border-[#ECECEC] flex items-center justify-center">
                          <Sparkles className="h-3 w-3 text-[#111111]" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-medium text-[#111111]">{candidate.full_name || "Unknown"}</h3>
                      <p className="text-xs text-[#6B7280] mt-0.5">
                        {candidate.current_title || ""}
                        {candidate.current_title && candidate.current_company ? " · " : ""}
                        {candidate.current_company && <span className="text-[#111111]/60">{candidate.current_company}</span>}
                      </p>

                      <div className="flex flex-wrap items-center gap-1.5 mt-3">
                        {(candidate.skills || []).slice(0, 3).map((skill, j) => (
                          <span key={j} className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#F6F6F4] text-[#6B7280]">
                            {skill}
                          </span>
                        ))}
                        {(candidate.skills?.length || 0) > 3 && (
                          <span className="text-[11px] text-[#A3A3A3] font-medium">+{(candidate.skills?.length || 0) - 3}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-3">
                        {candidate.total_experience_years != null && (
                          <span className="text-[11px] text-[#A3A3A3] flex items-center gap-1">
                            <Briefcase className="h-3 w-3" strokeWidth={1.5} />
                            {candidate.total_experience_years}y exp
                          </span>
                        )}
                        {candidate.location && (
                          <span className="text-[11px] text-[#A3A3A3] flex items-center gap-1">
                            <MapPin className="h-3 w-3" strokeWidth={1.5} />
                            {candidate.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-5 pt-5 border-t border-[#ECECEC]">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-medium border ${
                        (() => { const c = statusConfig(candidate.current_status); return `${c.bg} ${c.color} border-transparent`; })()
                      }`}>
                        {candidate.current_status || "Applied"}
                      </span>
                      {candidate.flight_risk && (
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-medium border ${
                          candidate.flight_risk === "High"
                            ? "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20"
                            : candidate.flight_risk === "Medium"
                            ? "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20"
                            : "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/20"
                        }`}>
                          {candidate.flight_risk} risk
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs font-medium text-[#111111] tabular-nums">
                          {candidate.match_score !== undefined ? `${Math.round(candidate.match_score)}%` : "—"}
                        </p>
                        <p className="text-[10px] text-[#A3A3A3]">{getScoreLabel(candidate.match_score)}</p>
                      </div>
                      <div className="w-12 h-1.5 bg-[#ECECEC] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${Math.round(candidate.match_score ?? 0)}%`, backgroundColor: getScoreColor(candidate.match_score) }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {candidate.resume_file_url && (
                      <a href={candidate.resume_file_url} target="_blank" rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-[#A3A3A3] hover:text-[#111111] hover:bg-[#F6F6F4] transition-all"
                      >
                        <FileText className="h-3 w-3" strokeWidth={1.5} />
                      </a>
                    )}
                    {candidate.current_status === "Offered" && (
                      <button onClick={(e) => { e.stopPropagation(); handleHireClick(candidate) }}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-[#16A34A] hover:bg-[#16A34A]/10 transition-all"
                      >
                        <BadgeCheck className="h-3 w-3" strokeWidth={1.5} />
                      </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); handleViewCandidate(candidate) }}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-[#A3A3A3] hover:text-[#111111] hover:bg-[#F6F6F4] transition-all ml-auto"
                    >
                      <Eye className="h-3 w-3" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-[#6B7280]">
                Showing {startRow}–{endRow} of {candidatesData?.total} candidates
              </p>
              <div className="flex items-center gap-1">
                <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-[#ECECEC] bg-white text-[#6B7280] hover:text-[#111111] hover:bg-[#F6F6F4] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pageNum: number
                  if (totalPages <= 5) pageNum = i + 1
                  else if (page <= 3) pageNum = i + 1
                  else if (page >= totalPages - 2) pageNum = totalPages - 4 + i
                  else pageNum = page - 2 + i
                  return (
                    <button key={pageNum} onClick={() => setPage(pageNum)}
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-all ${
                        pageNum === page
                          ? "bg-[#111111] text-white"
                          : "border border-[#ECECEC] bg-white text-[#6B7280] hover:text-[#111111] hover:bg-[#F6F6F4]"
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
                <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-[#ECECEC] bg-white text-[#6B7280] hover:text-[#111111] hover:bg-[#F6F6F4] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Hire confirmation */}
      <Dialog open={showHireConfirm} onOpenChange={(o) => { if (!o) { setShowHireConfirm(false); setHireCandidate(null) } }}>
        <DialogContent className="sm:max-w-md">
          <div className="px-6 pt-6 pb-2">
            <div className="flex items-center gap-2 text-[#16A34A] mb-3">
              <BadgeCheck className="h-5 w-5" />
              <h2 className="text-base font-medium text-[#111111]">Mark as Hired</h2>
            </div>
            <p className="text-sm text-[#6B7280]">
              Confirm that <strong className="text-[#111111]">{hireCandidate?.full_name || "this candidate"}</strong> has been hired.
            </p>
          </div>
          <div className="px-6 pb-6 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setShowHireConfirm(false); setHireCandidate(null) }} disabled={hireLoading}>
              Cancel
            </Button>
            <Button size="sm" className="bg-[#111111] text-white hover:bg-[#2A2A2A]" onClick={confirmHire} disabled={hireLoading}>
              {hireLoading && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Confirm Hired
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CandidateDetailModal
        open={showDetailModal}
        onClose={() => { setShowDetailModal(false); setSelectedCandidate(null) }}
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
