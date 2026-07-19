"use client"

import { Suspense, useState, useCallback, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import useSWR from "swr"
import {
  Users, FileText, ChevronLeft, ChevronRight,
  BadgeCheck, Loader2, Search, Sparkles, Eye,
  Briefcase, Download, Plus,
  ArrowUpRight, MapPin,
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
  const configs: Record<string, { label: string; color: string }> = {
    hired: { label: "Hired", color: "text-success" },
    offered: { label: "Offered", color: "text-text-primary" },
    rejected: { label: "Rejected", color: "text-danger" },
    screening: { label: "Screening", color: "text-warning" },
    interview: { label: "Interview", color: "text-text-secondary" },
    applied: { label: "Applied", color: "text-text-secondary" },
  }
  return configs[s] || configs.applied
}

function getScoreColor(score?: number) {
  if (!score) return "#9CA3AF"
  if (score >= 80) return "#0A0A0A"
  if (score >= 60) return "#6B6B6B"
  if (score >= 40) return "#D97706"
  return "#DC2626"
}

function getScoreLabel(score?: number) {
  if (!score) return "—"
  if (score >= 80) return "Excellent"
  if (score >= 60) return "Strong"
  if (score >= 40) return "Fair"
  return "Low"
}

function StatusDot({ status }: { status?: string }) {
  const s = (status || "applied").toLowerCase()
  const color =
    s === "applied" ? "#9CA3AF" :
    s === "screening" || s === "interview scheduled" || s === "interview completed" || s === "technical round" || s === "hr round" ? "#1E40AF" :
    s === "rejected" ? "#DC2626" :
    s === "hired" || s === "offered" ? "#16A34A" :
    "#D97706"
  return <span className="inline-block rounded-full shrink-0" style={{ width: 6, height: 6, backgroundColor: color }} />
}

function CandidatesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
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

  const candidatesKey = ["candidates-page", selectedSessionId, searchQuery, page, statusFilterParam]
  const { data: candidatesRes, error: candidatesError, isLoading: candidatesLoading, mutate: mutateCandidates } = useSWR(
    candidatesKey,
    () => api.getCandidatesPage({
      page, limit: PAGE_SIZE, search: searchQuery || undefined,
      sessionId: selectedSessionId || undefined, sortBy: "created_at", sortOrder: "desc",
      status: statusFilterParam || undefined,
    }),
    { revalidateOnFocus: false, revalidateOnReconnect: false, keepPreviousData: true, dedupingInterval: 10_000 },
  )

  const candidatesData = candidatesRes?.data ?? null
  const sessions = candidatesData?.sessions ?? []

  useWebSocket("candidate:status_changed", useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => mutateCandidates(), 500)
  }, [mutateCandidates]))

  const handleSearch = useCallback((value: string) => { setSearchQuery(value); setPage(1) }, [])
  const handleSelectSession = useCallback((sessionId: string | null) => { setSelectedSessionId(sessionId); setSearchQuery(""); setPage(1) }, [])
  const handleViewCandidate = useCallback((candidate: CandidateRecord) => { setSelectedCandidate(candidate); setShowDetailModal(true) }, [])
  const handleHireClick = useCallback((candidate: CandidateRecord) => { setHireCandidate(candidate); setShowHireConfirm(true) }, [])

  const confirmHire = async () => {
    if (!hireCandidate) return
    setHireLoading(true)
    setShowHireConfirm(false)
    setHireCandidate(null)

    if (candidatesRes?.data) {
      mutateCandidates({
        ...candidatesRes,
        data: {
          ...candidatesRes.data,
          candidates: candidatesRes.data.candidates.map((c) =>
            c.id === hireCandidate.id ? { ...c, current_status: "Hired" } : c
          ),
        },
      }, false)
    }

    try {
      const res = await api.markCandidateAsHired(hireCandidate.id)
      if (!res.success) throw new Error(res.error)
      toast.success("Candidate marked as Hired!")
      mutateCandidates()
    } catch {
      toast.error("Failed to mark candidate as hired")
      mutateCandidates()
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
          <h1 className="text-xl font-medium text-text-primary tracking-tight">Candidates</h1>
          <p className="text-sm text-text-secondary mt-1">
            {selectedSessionId ? "Filtered by hiring session" : "All candidates across all sessions"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4 px-4 py-2 rounded-full bg-white border border-border">
            <div className="text-center">
              <p className="text-sm font-medium text-text-primary tabular-nums">{candidatesData?.total ?? 0}</p>
              <p className="text-[10px] text-text-muted">Total</p>
            </div>
            <div className="w-px h-6 bg-[#ECECEC]" />
            <div className="text-center">
              <p className="text-sm font-medium text-text-primary tabular-nums">{avgMatchScore}%</p>
              <p className="text-[10px] text-text-muted">Avg Match</p>
            </div>
            <div className="w-px h-6 bg-[#ECECEC]" />
            <div className="text-center">
              <p className="text-sm font-medium text-text-secondary tabular-nums">{pendingInterviews}</p>
              <p className="text-[10px] text-text-muted">Interviews</p>
            </div>
          </div>
          <Button variant="outline" size="sm">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export
          </Button>
          <Button size="sm" className="bg-primary text-white hover:bg-[#2A2A2A]">
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
                ? "bg-primary text-white border-[#111111]"
                : "bg-white border-border text-text-secondary hover:text-text-primary hover:border-[#D4D4D4]"
            }`}
          >
            <Users className="h-3.5 w-3.5" strokeWidth={1.5} />
            All Candidates
          </button>
          {candidatesLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-32 rounded-full shrink-0" />)
          ) : sessions.length === 0 ? (
            <span className="text-xs text-text-muted px-2">No sessions yet</span>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => handleSelectSession(session.id)}
                className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all border whitespace-nowrap ${
                  selectedSessionId === session.id
                    ? "bg-primary text-white border-[#111111]"
                    : "bg-white border-border text-text-secondary hover:text-text-primary hover:border-[#D4D4D4]"
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
        <div className="flex items-center gap-1.5 bg-surface-secondary rounded-full p-1">
          {statusTabs.map((tab) => {
            const isActive = tab.value === null ? !statusFilterParam : statusFilterParam === tab.value || statusFilterParam?.split(",").includes(tab.value || "")
            return (
              <button
                key={tab.label}
                onClick={() => handleStatusTabClick(tab.value)}
                className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all ${
                  isActive ? "bg-white text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" strokeWidth={1.5} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search candidates..."
            className="w-64 h-9 rounded-full border border-border bg-white pl-9 pr-4 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-[#111111] focus:shadow-[0_0_0_3px_rgba(17,17,17,0.06)] transition-all"
          />
        </div>
      </motion.div>

      {/* Candidate Grid */}
      {candidatesLoading ? (
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-[10px] border border-border p-6">
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
        <div className="bg-white rounded-[10px] border border-border shadow-none p-20">
          <div className="flex flex-col items-center text-center max-w-sm mx-auto">
            <div className="h-16 w-16 rounded-[10px] bg-surface-secondary flex items-center justify-center mb-5">
              <Users className="h-7 w-7 text-text-muted" strokeWidth={1.5} />
            </div>
            <h3 className="text-base font-medium text-text-primary mb-1">
              {searchQuery ? "No candidates found" : "No candidates yet"}
            </h3>
            <p className="text-sm text-text-secondary mb-6 leading-relaxed">
              {searchQuery ? "Try a different search term or clear filters" : "Upload resumes or create an application link to start building your candidate database."}
            </p>
            <div className="flex gap-3">
              <Button size="sm" className="bg-primary text-white hover:bg-[#2A2A2A]">
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
                className="group bg-white rounded-[10px] border border-border shadow-none hover:border-border-strong transition-all duration-120 cursor-pointer overflow-hidden"
                onClick={() => handleViewCandidate(candidate)}
              >
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="relative">
                      <Avatar className="h-14 w-14 ring-2 ring-white shadow-sm shrink-0">
                        <AvatarFallback className="text-base font-medium bg-surface-secondary text-text-secondary">
                          {getInitials(candidate.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      {candidate.match_score !== undefined && candidate.match_score >= 85 && (
                        <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-white shadow-sm border border-border flex items-center justify-center">
                          <Sparkles className="h-3 w-3 text-text-primary" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-medium text-text-primary">{candidate.full_name || "Unknown"}</h3>
                      <p className="text-xs text-text-secondary mt-0.5">
                        {candidate.current_title || ""}
                        {candidate.current_title && candidate.current_company ? " · " : ""}
                        {candidate.current_company && <span className="text-text-primary/60">{candidate.current_company}</span>}
                      </p>

                      <div className="flex flex-wrap items-center gap-1.5 mt-3">
                        {(candidate.skills || []).slice(0, 3).map((skill, j) => (
                          <span key={j} className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-surface-secondary text-text-secondary">
                            {skill}
                          </span>
                        ))}
                        {(candidate.skills?.length || 0) > 3 && (
                          <span className="text-[11px] text-text-muted font-medium">+{(candidate.skills?.length || 0) - 3}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-3">
                        {candidate.total_experience_years != null && (
                          <span className="text-[11px] text-text-muted flex items-center gap-1">
                            <Briefcase className="h-3 w-3" strokeWidth={1.5} />
                            {candidate.total_experience_years}y exp
                          </span>
                        )}
                        {candidate.location && (
                          <span className="text-[11px] text-text-muted flex items-center gap-1">
                            <MapPin className="h-3 w-3" strokeWidth={1.5} />
                            {candidate.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                    <div className="flex items-center gap-3">
                      <StatusDot status={candidate.current_status} />
                      <span className="text-[13px] text-text-secondary" style={{ fontFamily: "var(--font-inter)" }}>
                        {candidate.current_status || "Applied"}
                      </span>
                      {candidate.flight_risk && (
                        <span className={`font-data text-xs ${
                          candidate.flight_risk === "High"
                            ? "text-danger"
                            : candidate.flight_risk === "Medium"
                            ? "text-warning"
                            : "text-success"
                        }`}>
                          {candidate.flight_risk} risk
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs font-medium text-text-primary tabular-nums">
                          {candidate.match_score !== undefined ? `${Math.round(candidate.match_score)}%` : "—"}
                        </p>
                        <p className="text-[10px] text-text-muted">{getScoreLabel(candidate.match_score)}</p>
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
                        className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted hover:text-text-primary hover:bg-surface-secondary transition-all"
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
                      className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted hover:text-text-primary hover:bg-surface-secondary transition-all ml-auto"
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
              <p className="text-xs text-text-secondary">
                Showing {startRow}–{endRow} of {candidatesData?.total} candidates
              </p>
              <div className="flex items-center gap-1">
                <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-white text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-all disabled:opacity-30 disabled:cursor-not-allowed"
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
                          ? "bg-primary text-white"
                          : "border border-border bg-white text-text-secondary hover:text-text-primary hover:bg-surface-secondary"
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
                <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-white text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-all disabled:opacity-30 disabled:cursor-not-allowed"
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
              <h2 className="text-base font-medium text-text-primary">Mark as Hired</h2>
            </div>
            <p className="text-sm text-text-secondary">
              Confirm that <strong className="text-text-primary">{hireCandidate?.full_name || "this candidate"}</strong> has been hired.
            </p>
          </div>
          <div className="px-6 pb-6 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setShowHireConfirm(false); setHireCandidate(null) }} disabled={hireLoading}>
              Cancel
            </Button>
            <Button size="sm" className="bg-primary text-white hover:bg-[#2A2A2A]" onClick={confirmHire} disabled={hireLoading}>
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
        onStatusChange={() => mutateCandidates()}
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
