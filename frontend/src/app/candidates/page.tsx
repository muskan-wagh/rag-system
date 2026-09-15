"use client"

import { Suspense, useState, useCallback, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import useSWR from "swr"
import {
  Users, FileText, ChevronLeft, ChevronRight,
  BadgeCheck, Loader2, Search, Sparkles, Eye,
  Briefcase, Download, Plus,
  ArrowUpRight, MapPin,
} from "lucide-react"
import { toast } from "sonner"
import { CandidateDetailModal } from "@/components/candidate-detail-modal"
import { GmailOutreachModal } from "@/components/gmail-outreach-modal"
import { GmailLogo } from "@/components/gmail-logo"
import { useApi } from "@/hooks/use-api"
import { useWebSocket } from "@/lib/use-websocket"
import { ROUTES, getInitials } from "@/lib/constants"
import type { CandidateRecord } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { PageHeader } from "@/components/ui/page-header"
import { EmptyState } from "@/components/ui/empty-state"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 20

type StatusTone = "amber" | "blue" | "green" | "red" | "neutral"

function getStatusTone(status?: string): StatusTone {
  const s = (status || "").toLowerCase()
  if (s === "hired" || s === "offered" || s === "pending offer") return "green"
  if (s === "rejected") return "red"
  if (s.includes("interview") || s === "technical round" || s === "hr round") return "blue"
  if (s === "applied" || s === "screening" || s === "shortlisted") return "amber"
  return "neutral"
}

// Thick left-edge status indicator — solid in both themes.
const STATUS_LINE: Record<StatusTone, string> = {
  amber: "bg-amber-400",
  blue: "bg-blue-500",
  green: "bg-green-500",
  red: "bg-red-500",
  neutral: "bg-zinc-400 dark:bg-zinc-600",
}

// Color-coded status text — readable on dark surfaces without loud backgrounds.
const STATUS_TEXT: Record<StatusTone, string> = {
  amber: "text-amber-700 dark:text-amber-400",
  blue: "text-blue-700 dark:text-blue-400",
  green: "text-green-700 dark:text-green-400",
  red: "text-red-600 dark:text-red-400",
  neutral: "text-muted",
}

function getScoreTone(score?: number) {
  if (!score) return "text-muted"
  if (score >= 80) return "text-success"
  if (score >= 60) return "text-warning"
  return "text-danger"
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
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(1)
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateRecord | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [emailCandidate, setEmailCandidate] = useState<CandidateRecord | null>(null)
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
  const { data: candidatesRes, isLoading: candidatesLoading, mutate: mutateCandidates } = useSWR(
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
  const candidates = candidatesData?.candidates ?? []

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
  const avgMatchScore = candidates.length
    ? Math.round(candidates.reduce((s, c) => s + (c.match_score ?? 0), 0) / candidates.length)
    : 0
  const pendingInterviews = candidates.filter(c => c.current_status?.toLowerCase() === "interview").length
  const hiredCount = candidates.filter(c => c.current_status?.toLowerCase() === "hired").length

  const statCards = [
    { label: "Total", value: candidatesData?.total ?? 0, icon: Users },
    { label: "Hired", value: hiredCount, icon: BadgeCheck },
    { label: "Avg Match", value: `${avgMatchScore}%`, icon: Sparkles },
    { label: "Interviews", value: pendingInterviews, icon: Briefcase },
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        title="Candidates"
        description={selectedSessionId ? "Filtered by hiring session" : "All candidates across all sessions"}
        actions={
          <>
            <Button variant="outline" size="sm">
              <Download className="size-3.5" strokeWidth={1.5} />
              Export
            </Button>
            <Button size="sm">
              <Plus className="size-3.5" strokeWidth={1.5} />
              Add Candidate
            </Button>
          </>
        }
      />

      {/* Stat strip */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3.5"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-secondary text-muted">
              <card.icon className="size-4" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <p className="font-data text-[15px] font-semibold leading-tight text-ink">{card.value}</p>
              <p className="text-[10px] uppercase tracking-[0.05em] text-muted">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Sessions bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => handleSelectSession(null)}
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-md border px-3 py-1.5 text-[12px] font-medium whitespace-nowrap transition-colors duration-120",
            selectedSessionId === null
              ? "border-transparent bg-ink text-canvas"
              : "border-border bg-surface text-muted hover:border-border-hover hover:text-ink",
          )}
        >
          <Users className="size-3.5" strokeWidth={1.5} />
          All Candidates
        </button>
        {candidatesLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-32 shrink-0 rounded-md" />)
        ) : sessions.length === 0 ? (
          <span className="px-2 text-[12px] text-muted">No sessions yet</span>
        ) : (
          sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => handleSelectSession(session.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-md border px-3 py-1.5 text-[12px] font-medium whitespace-nowrap transition-colors duration-120",
                selectedSessionId === session.id
                  ? "border-transparent bg-ink text-canvas"
                  : "border-border bg-surface text-muted hover:border-border-hover hover:text-ink",
              )}
            >
              <Briefcase className="size-3.5 shrink-0" strokeWidth={1.5} />
              <span className="max-w-[150px] truncate">
                {session.job_description_text
                  ? session.job_description_text.length > 35
                    ? `${session.job_description_text.slice(0, 35)}…`
                    : session.job_description_text
                  : "Untitled"}
              </span>
              <span className="font-data text-[10px] text-muted">{session.candidate_count}</span>
            </button>
          ))
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 self-start overflow-x-auto rounded-lg bg-surface-secondary p-1 sm:self-auto">
          {statusTabs.map((tab) => {
            const isActive = tab.value === null
              ? !statusFilterParam
              : statusFilterParam === tab.value || statusFilterParam?.split(",").includes(tab.value || "")
            return (
              <button
                key={tab.label}
                onClick={() => handleStatusTabClick(tab.value)}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-md px-3.5 py-1.5 text-[12px] font-medium transition-colors duration-120",
                  isActive
                    ? "bg-ink text-canvas shadow-sm"
                    : "text-muted hover:text-ink",
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" strokeWidth={1.5} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search candidates…"
            className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-3.5 text-[13px] text-ink outline-none transition-colors duration-120 placeholder:text-muted focus:border-border-hover sm:w-64"
          />
        </div>
      </div>

      {/* Candidate Grid */}
      {candidatesLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border bg-surface p-5">
              <div className="flex items-center gap-3">
                <Skeleton className="size-11 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Skeleton className="h-5 w-16 rounded-md" />
                <Skeleton className="h-5 w-20 rounded-md" />
              </div>
              <div className="mt-4 space-y-2">
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-2 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : candidates.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState
            icon={Users}
            title={searchQuery || statusFilterParam ? "No candidates found" : "No candidates yet"}
            description={
              searchQuery || statusFilterParam
                ? "Try a different search term or clear filters"
                : "Upload resumes or create an application link to start building your candidate database."
            }
            action={
              <div className="flex gap-2">
                <Button size="sm">
                  <Plus className="size-3.5" strokeWidth={1.5} />
                  Upload Resume
                </Button>
                <Button variant="outline" size="sm" onClick={() => router.push(ROUTES.dashboard)}>
                  <ArrowUpRight className="size-3.5" strokeWidth={1.5} />
                  Go to Dashboard
                </Button>
              </div>
            }
          />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {candidates.map((candidate) => {
              const tone = getStatusTone(candidate.current_status)
              return (
                <div
                  key={candidate.id}
                  className="group relative cursor-pointer overflow-hidden rounded-xl border border-border bg-surface transition-all duration-200 hover:border-border-hover hover:bg-hover-tone"
                  onClick={() => handleViewCandidate(candidate)}
                >
                  {/* Thick vertical status indicator */}
                  <span
                    aria-hidden
                    className={cn("absolute inset-y-0 left-0 w-1", STATUS_LINE[tone])}
                  />
                  <div className="p-5 pl-6">
                    <div className="flex items-start gap-3">
                      <div className="relative shrink-0">
                        <Avatar className="size-11">
                          <AvatarFallback className="text-[13px] font-medium">
                            {getInitials(candidate.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        {candidate.match_score !== undefined && candidate.match_score >= 85 && (
                          <div className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full border border-border bg-surface">
                            <Sparkles className="size-3 text-warning" strokeWidth={1.5} />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-[15px] font-semibold text-ink">
                          {candidate.full_name || "Unknown"}
                        </h3>
                        <p className="mt-0.5 truncate text-[12px] text-muted">
                          {candidate.current_title || ""}
                          {candidate.current_title && candidate.current_company ? " · " : ""}
                          {candidate.current_company || ""}
                        </p>

                        {(candidate.skills || []).length > 0 && (
                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                            {(candidate.skills || []).slice(0, 3).map((skill, j) => (
                              <span
                                key={j}
                                className="rounded-md border border-border bg-surface-secondary px-2 py-0.5 text-[11px] text-zinc-600 dark:text-zinc-300"
                              >
                                {skill}
                              </span>
                            ))}
                            {(candidate.skills?.length || 0) > 3 && (
                              <span className="text-[11px] text-muted">+{(candidate.skills?.length || 0) - 3}</span>
                            )}
                          </div>
                        )}

                        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                          {candidate.total_experience_years != null && (
                            <span className="flex items-center gap-1 text-[11px] text-muted">
                              <Briefcase className="size-3" strokeWidth={1.5} />
                              {candidate.total_experience_years}y exp
                            </span>
                          )}
                          {candidate.location && (
                            <span className="flex items-center gap-1 text-[11px] text-muted">
                              <MapPin className="size-3" strokeWidth={1.5} />
                              {candidate.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          aria-hidden
                          className={cn("size-1.5 shrink-0 rounded-full", STATUS_LINE[tone])}
                        />
                        <span className={cn("truncate text-[12px] font-medium", STATUS_TEXT[tone])}>
                          {candidate.current_status || "Applied"}
                        </span>
                        {candidate.flight_risk && (
                          <span className={cn(
                            "shrink-0 font-data text-[11px]",
                            candidate.flight_risk === "High"
                              ? "text-danger"
                              : candidate.flight_risk === "Medium"
                                ? "text-warning"
                                : "text-success",
                          )}>
                            {candidate.flight_risk} risk
                          </span>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-2.5">
                        <div className="text-right">
                          <p className={cn("font-data text-[13px] font-semibold", getScoreTone(candidate.match_score))}>
                            {candidate.match_score !== undefined ? `${Math.round(candidate.match_score)}%` : "—"}
                          </p>
                          <p className="text-[10px] text-muted">{getScoreLabel(candidate.match_score)}</p>
                        </div>
                        <div className="h-1 w-12 overflow-hidden rounded-full bg-track">
                          <div
                            className="h-full rounded-full bg-info"
                            style={{ width: `${Math.round(candidate.match_score ?? 0)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-1 opacity-100 transition-opacity duration-150 focus-within:opacity-100 lg:opacity-0 lg:group-hover:opacity-100">
                      {candidate.resume_file_url && (
                        <a
                          href={candidate.resume_file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex size-7 items-center justify-center rounded-md text-muted transition-colors duration-120 hover:bg-surface-secondary hover:text-ink"
                          aria-label="Open resume"
                        >
                          <FileText className="size-3.5" strokeWidth={1.5} />
                        </a>
                      )}
                      {candidate.current_status === "Offered" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleHireClick(candidate) }}
                          className="flex size-7 items-center justify-center rounded-md text-success transition-colors duration-120 hover:bg-success/10"
                          aria-label="Mark as hired"
                        >
                          <BadgeCheck className="size-3.5" strokeWidth={1.5} />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleViewCandidate(candidate) }}
                        className="ml-auto flex size-7 items-center justify-center rounded-md text-muted transition-colors duration-120 hover:bg-surface-secondary hover:text-ink"
                        aria-label="View details"
                      >
                        <Eye className="size-3.5" strokeWidth={1.5} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setEmailCandidate(candidate) }}
                        disabled={!candidate.email}
                        title={candidate.email ? `Send outreach to ${candidate.full_name || "candidate"}` : "No email on file"}
                        className="flex size-7 items-center justify-center rounded-md text-muted transition-colors duration-120 hover:bg-surface-secondary hover:text-ink disabled:opacity-40"
                        aria-label="Send email"
                      >
                        <GmailLogo className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[12px] text-muted">
                Showing <span className="font-data">{startRow}–{endRow}</span> of{" "}
                <span className="font-data">{candidatesData?.total}</span> candidates
              </p>
              <div className="flex items-center gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="flex size-8 items-center justify-center rounded-md border border-border bg-surface text-muted transition-colors duration-120 hover:bg-surface-secondary hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="size-3.5" strokeWidth={1.5} />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pageNum: number
                  if (totalPages <= 5) pageNum = i + 1
                  else if (page <= 3) pageNum = i + 1
                  else if (page >= totalPages - 2) pageNum = totalPages - 4 + i
                  else pageNum = page - 2 + i
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={cn(
                        "flex size-8 items-center justify-center rounded-md text-[12px] font-medium transition-colors duration-120",
                        pageNum === page
                          ? "bg-ink text-canvas"
                          : "border border-border bg-surface text-muted hover:bg-surface-secondary hover:text-ink",
                      )}
                    >
                      {pageNum}
                    </button>
                  )
                })}
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="flex size-8 items-center justify-center rounded-md border border-border bg-surface text-muted transition-colors duration-120 hover:bg-surface-secondary hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Next page"
                >
                  <ChevronRight className="size-3.5" strokeWidth={1.5} />
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
            <div className="mb-3 flex items-center gap-2 text-success">
              <BadgeCheck className="size-5" strokeWidth={1.5} />
              <h2 className="text-[15px] font-medium text-ink">Mark as Hired</h2>
            </div>
            <p className="text-[13px] text-muted">
              Confirm that <strong className="text-ink">{hireCandidate?.full_name || "this candidate"}</strong> has been hired.
            </p>
          </div>
          <div className="flex justify-end gap-2 px-6 pb-6">
            <Button variant="outline" size="sm" onClick={() => { setShowHireConfirm(false); setHireCandidate(null) }} disabled={hireLoading}>
              Cancel
            </Button>
            <Button size="sm" onClick={confirmHire} disabled={hireLoading}>
              {hireLoading && <Loader2 className="size-3.5 animate-spin" />}
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

      {emailCandidate && (
        <GmailOutreachModal
          open
          onClose={() => setEmailCandidate(null)}
          candidateId={emailCandidate.id}
          candidateName={emailCandidate.full_name || "Candidate"}
          candidateEmail={emailCandidate.email || ""}
        />
      )}
    </div>
  )
}

export default function CandidatesPage() {
  return (
    <Suspense fallback={null}>
      <CandidatesContent />
    </Suspense>
  )
}
