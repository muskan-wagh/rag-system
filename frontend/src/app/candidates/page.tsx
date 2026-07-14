"use client"

import { Suspense, useState, useEffect, useCallback, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  Search, Users, FileText, ChevronLeft, ChevronRight,
  LayoutDashboard, BadgeCheck, Loader2,
} from "lucide-react"
import { toast } from "sonner"
import { CandidateDetailModal } from "@/components/candidate-detail-modal"
import { getCandidatesPage, markCandidateAsHired } from "@/lib/api"
import { useWebSocket } from "@/lib/use-websocket"
import { ROUTES } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { getStatusColor } from "@/lib/constants"
import type { SessionSummary, CandidateRecord, CandidatesPageData, StatusFilter } from "@/lib/api"

function getInitials(name?: string): string {
  return (name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function getFlightRiskColor(risk?: string): "destructive" | "default" | "outline" {
  const r = (risk || "").toLowerCase()
  if (r === "high") return "destructive"
  if (r === "medium") return "default"
  return "outline"
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—"
  try {
    return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
  } catch {
    return dateStr
  }
}

const PAGE_SIZE = 20

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
  const searchInputRef = useRef<HTMLInputElement>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Read status filter from URL
  const statusFilterParam = searchParams.get("status") as StatusFilter | null

  // Filter tab configuration
  const statusTabs = [
    { label: "All", value: null },
    { label: "Hired", value: "hired" },
    { label: "Pending Offers", value: "offer" },
    { label: "Rejected", value: "rejected" },
  ] as const

  // Single function that loads everything the Candidates page needs in ONE API call
  const loadCandidatesPage = useCallback(async (sessionId: string | null, query: string, currentPage: number, statusFilter?: string | null) => {
    setCandidatesLoading(true)
    setSessionsLoading(true)
    try {
      const res = await getCandidatesPage({
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
    } catch (e) {
      console.error("Failed to load candidates page:", e)
      toast.error("Failed to load candidates")
    } finally {
      setCandidatesLoading(false)
      setSessionsLoading(false)
    }
  }, [])

  // Read session from URL on mount, then load everything
  useEffect(() => {
    async function init() {
      const sessionFromUrl = searchParams.get("session")
      if (sessionFromUrl) {
        setSelectedSessionId(sessionFromUrl)
      }
    }
    init()
  }, [searchParams])

  // Load candidates page data — single API call replaces the old 2-request waterfall
  useEffect(() => {
    async function init() {
      await loadCandidatesPage(selectedSessionId, searchQuery, page, statusFilterParam)
    }
    init()
  }, [selectedSessionId, searchQuery, page, statusFilterParam, loadCandidatesPage])

  // WebSocket updates — debounced to prevent burst refetches on rapid status changes
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
      const res = await markCandidateAsHired(hireCandidate.id)
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

  return (
    <div className="flex-1 flex">
      {/* Left Sidebar - Sessions */}
      <aside className="w-64 shrink-0 border-r bg-muted/10 hidden md:flex flex-col">
        <div className="p-4 border-b">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4 text-primary" />
            Hiring Sessions
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          <button
            onClick={() => handleSelectSession(null)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
              selectedSessionId === null
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <span className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5" />
              All Candidates
            </span>
          </button>
          <div className="h-px bg-border my-1" />
          {sessionsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-3 py-2">
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))
          ) : sessions.length === 0 ? (
            <p className="text-xs text-muted-foreground px-3 py-4 text-center">
              No sessions yet
            </p>
          ) : (
            sessions.map((session) => {
              const truncatedText = session.job_description_text
                ? session.job_description_text.length > 55
                  ? session.job_description_text.slice(0, 55) + "..."
                  : session.job_description_text
                : "Untitled Session"
              return (
                <button
                  key={session.id}
                  onClick={() => handleSelectSession(session.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedSessionId === session.id
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <p className="truncate text-xs font-medium">{truncatedText}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {session.candidate_count} candidate{session.candidate_count !== 1 ? "s" : ""}
                  </p>
                </button>
              )
            })
          )}
        </div>
        <div className="p-3 border-t">
          <Link href={ROUTES.dashboard}>
            <Button variant="outline" size="sm" className="w-full text-xs">
              <LayoutDashboard className="h-3 w-3 mr-1" />
              Go to Dashboard
            </Button>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Candidate Database
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {selectedSessionId
              ? "Candidates filtered by selected hiring session"
              : "All candidates across all hiring sessions"}
          </p>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 border-b border-border pb-3 -mb-2">
          {statusTabs.map((tab) => {
            const isActive = tab.value === null
              ? !statusFilterParam
              : statusFilterParam === tab.value || statusFilterParam?.split(",").includes(tab.value || "")
            return (
              <button
                key={tab.label}
                onClick={() => handleStatusTabClick(tab.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Search & Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by name, email, or company..."
              className="w-full h-9 pl-9 pr-4 text-sm rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
          {candidatesData && (
            <span className="text-xs text-muted-foreground shrink-0">
              {candidatesData.total} candidate{candidatesData.total !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Candidate Table */}
        <Card className="p-0 overflow-hidden border shadow-sm">
          {candidatesLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-2 w-24" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-8 w-16" />
                </div>
              ))}
            </div>
          ) : candidatesData?.candidates.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No candidates found"
              description={searchQuery ? "Try a different search term" : "Upload resumes to start building your candidate database."}
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Experience</TableHead>
                      <TableHead className="hidden lg:table-cell">Skills</TableHead>
                      <TableHead className="hidden sm:table-cell">Flight Risk</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">Applied</TableHead>
                      <TableHead>Resume</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidatesData?.candidates.map((candidate) => (
                      <TableRow key={candidate.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {getInitials(candidate.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate max-w-[180px]">
                                {candidate.full_name || "Unknown"}
                              </p>
                              {candidate.current_title && (
                                <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                                  {candidate.current_title}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {candidate.current_company || "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-mono">
                            {candidate.total_experience_years != null
                              ? `${candidate.total_experience_years}y`
                              : "—"}
                          </span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {(candidate.skills || []).slice(0, 3).map((skill, i) => (
                              <Badge key={i} variant="secondary" className="text-[10px]">
                                {skill}
                              </Badge>
                            ))}
                            {(candidate.skills?.length || 0) > 3 && (
                              <Badge variant="outline" className="text-[10px]">
                                +{(candidate.skills?.length || 0) - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant={getFlightRiskColor(candidate.flight_risk)} className="capitalize text-xs">
                            {candidate.flight_risk || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(candidate.current_status)}`}>
                            {candidate.current_status || "Pending"}
                          </span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(candidate.created_at)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {candidate.resume_file_url ? (
                            <a
                              href={candidate.resume_file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors hover:bg-muted hover:text-foreground text-muted-foreground"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">View</span>
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {candidate.current_status === "Offer" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleHireClick(candidate)}
                                className="h-8 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                title="Mark as Hired"
                              >
                                <BadgeCheck className="h-3.5 w-3.5 mr-1" />
                                Mark as Hired
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewCandidate(candidate)}
                            >
                              View
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
                  <span className="text-xs text-muted-foreground">
                    Showing {startRow}–{endRow} of {candidatesData?.total}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="h-8 px-2"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
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
                        <Button
                          key={pageNum}
                          variant={pageNum === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setPage(pageNum)}
                          className="h-8 w-8 p-0 text-xs"
                        >
                          {pageNum}
                        </Button>
                      )
                    })}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="h-8 px-2"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      {/* Mark as Hired Confirmation */}
      <Dialog open={showHireConfirm} onOpenChange={(o) => { if (!o) { setShowHireConfirm(false); setHireCandidate(null) } }}>
        <DialogContent className="sm:max-w-md">
          <div className="px-6 pt-6 pb-2">
            <div className="flex items-center gap-2 text-emerald-600">
              <BadgeCheck className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Mark as Hired</h2>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Confirm that <strong>{hireCandidate?.full_name || "this candidate"}</strong> has been hired.
              This will update their status from Offer to Hired.
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
