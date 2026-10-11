"use client"

import { Suspense, useState, useCallback, useRef, useMemo } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import useSWR from "swr"
import {
  Users, FileText, BadgeCheck, Loader2, Search, Sparkles, Eye,
  Briefcase, Plus, MapPin, X,
} from "lucide-react"
import { toast } from "sonner"
import { CandidateDetailModal } from "@/components/candidate-detail-modal"
import { GmailOutreachModal } from "@/components/gmail-outreach-modal"
import { GmailLogo } from "@/components/gmail-logo"
import { useApi } from "@/hooks/use-api"
import { useWebSocket } from "@/lib/use-websocket"
import { ROUTES, getInitials } from "@/lib/constants"
import type { CandidateRecord } from "@/lib/api"
import { stageDotClass, STAGE_FILTERS } from "@/lib/pipeline"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { PageHeader } from "@/components/ui/page-header"
import { EmptyState } from "@/components/ui/empty-state"
import { StatTile } from "@/components/ui/stat-tile"
import { StageBadge } from "@/components/ui/stage-badge"
import { Pagination } from "@/components/ui/pagination"

const PAGE_SIZE = 20

/** Score bands drive both the number colour and its word label. */
function getScoreTone(score?: number) {
  if (score == null) return "text-muted"
  if (score >= 80) return "text-success"
  if (score >= 60) return "text-warning"
  return "text-danger"
}

function getScoreBar(score?: number) {
  if (score == null) return "bg-faint"
  if (score >= 80) return "bg-success"
  if (score >= 60) return "bg-warning"
  return "bg-danger"
}

function getScoreLabel(score?: number) {
  if (score == null) return "Not scored"
  if (score >= 80) return "Strong match"
  if (score >= 60) return "Good match"
  if (score >= 40) return "Partial match"
  return "Weak match"
}

function flightRiskTone(risk?: string) {
  const r = (risk || "").toLowerCase()
  if (r === "high") return "text-danger"
  if (r === "medium") return "text-warning"
  return "text-success"
}

const INTERVIEW_STAGES = new Set([
  "interview",
  "interview scheduled",
  "interview completed",
  "technical round",
  "technical interview",
  "hr round",
  "managerial/hr",
])

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

  // Mirrors the backend STATUS_FILTER_MAP so every dashboard tile that links
  // here lands on a visible, selected filter rather than an invisible one.
  const statusTabs = useMemo(
    () => [{ label: "All", value: null as string | null }, ...STAGE_FILTERS.filter((f) => f.value !== "all").map((f) => ({ label: f.label, value: f.value }))],
    [],
  )

  const api = useApi()

  const candidatesKey = ["candidates-page", selectedSessionId, searchQuery, page, statusFilterParam]
  const { data: candidatesRes, isLoading: candidatesLoading, mutate: mutateCandidates } = useSWR(
    candidatesKey,
    () =>
      api.getCandidatesPage({
        page,
        limit: PAGE_SIZE,
        search: searchQuery || undefined,
        sessionId: selectedSessionId || undefined,
        sortBy: "created_at",
        sortOrder: "desc",
        status: statusFilterParam || undefined,
      }),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      keepPreviousData: true,
      dedupingInterval: 10_000,
    },
  )

  const candidatesData = candidatesRes?.data ?? null
  const sessions = candidatesData?.sessions ?? []
  const candidates = candidatesData?.candidates ?? []

  useWebSocket(
    "candidate:status_changed",
    useCallback(() => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(() => mutateCandidates(), 500)
    }, [mutateCandidates]),
  )

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
    setShowHireConfirm(false)
    setHireCandidate(null)

    if (candidatesRes?.data) {
      mutateCandidates(
        {
          ...candidatesRes,
          data: {
            ...candidatesRes.data,
            candidates: candidatesRes.data.candidates.map((c) =>
              c.id === hireCandidate.id ? { ...c, current_status: "Hired" } : c,
            ),
          },
        },
        false,
      )
    }

    try {
      const res = await api.markCandidateAsHired(hireCandidate.id)
      if (!res.success) throw new Error(res.error)
      toast.success(`${hireCandidate.full_name || "Candidate"} marked as hired`)
      mutateCandidates()
    } catch {
      toast.error("Could not mark this candidate as hired. The stage was left unchanged.")
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
  const hasFilters = Boolean(searchQuery || statusFilterParam || selectedSessionId)

  const avgMatchScore = candidates.length
    ? Math.round(
        candidates.reduce((s, c) => s + (c.match_score ?? 0), 0) / candidates.length,
      )
    : null
  const pendingInterviews = candidates.filter((c) =>
    INTERVIEW_STAGES.has((c.current_status || "").toLowerCase()),
  ).length
  const hiredCount = candidates.filter(
    (c) => c.current_status?.toLowerCase() === "hired",
  ).length

  return (
    <div className="space-y-5">
      <PageHeader
        title="Candidates"
        description={
          selectedSessionId
            ? "Filtered to one hiring session"
            : "Every candidate across all sessions"
        }
        actions={
          <Button variant="action" render={<Link href={ROUTES.dashboard} />}>
            <Plus strokeWidth={2.25} />
            Add candidates
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        <StatTile
          label="Total"
          value={candidatesData?.total ?? 0}
          icon={Users}
          tone="neutral"
          loading={candidatesLoading && !candidatesData}
        />
        <StatTile
          label="Hired"
          value={hiredCount}
          icon={BadgeCheck}
          tone="success"
          href={candidatesRes ? `${ROUTES.candidates}?status=hired` : undefined}
          hint="On this page"
          loading={candidatesLoading && !candidatesData}
        />
        <StatTile
          label="Avg match"
          value={avgMatchScore == null ? "—" : `${avgMatchScore}%`}
          icon={Sparkles}
          tone="accent"
          hint="Across this page"
          loading={candidatesLoading && !candidatesData}
        />
        <StatTile
          label="Interviews"
          value={pendingInterviews}
          icon={Briefcase}
          tone="info"
          href={candidatesRes ? `${ROUTES.candidates}?status=technical` : undefined}
          hint="Awaiting a decision"
          loading={candidatesLoading && !candidatesData}
        />
      </div>

      {/* Session filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => handleSelectSession(null)}
          aria-pressed={selectedSessionId === null}
          className={cn(
            "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors duration-120",
            selectedSessionId === null
              ? "border-transparent bg-ink text-canvas"
              : "border-border bg-surface text-muted hover:border-border-hover hover:text-ink",
          )}
        >
          <Users className="size-3.5" strokeWidth={1.75} aria-hidden />
          All candidates
        </button>

        {candidatesLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-32 shrink-0 rounded-lg" />
          ))
        ) : sessions.length === 0 ? (
          <span className="px-2 text-[12px] text-muted">No hiring sessions yet</span>
        ) : (
          sessions.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => handleSelectSession(session.id)}
              aria-pressed={selectedSessionId === session.id}
              className={cn(
                "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors duration-120",
                selectedSessionId === session.id
                  ? "border-transparent bg-ink text-canvas"
                  : "border-border bg-surface text-muted hover:border-border-hover hover:text-ink",
              )}
            >
              <Briefcase className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
              <span className="max-w-[150px] truncate">
                {session.job_description_text
                  ? session.job_description_text.length > 35
                    ? `${session.job_description_text.slice(0, 35)}…`
                    : session.job_description_text
                  : "Untitled session"}
              </span>
              <span className="font-data text-[10px] opacity-70">{session.candidate_count}</span>
            </button>
          ))
        )}
      </div>

      {/* Stage filter + search */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          className="flex items-center gap-1 overflow-x-auto rounded-lg bg-surface-secondary p-1"
          role="tablist"
          aria-label="Filter by stage"
        >
          {statusTabs.map((tab) => {
            const isActive = tab.value === null
              ? !statusFilterParam
              : statusFilterParam === tab.value || statusFilterParam?.split(",").includes(tab.value || "")
            return (
              <button
                key={tab.label}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleStatusTabClick(tab.value)}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors duration-120",
                  isActive ? "bg-surface text-ink shadow-xs" : "text-muted hover:text-ink",
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 lg:w-64 lg:flex-none">
            <label htmlFor="candidate-search" className="sr-only">
              Search candidates
            </label>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-faint"
              strokeWidth={1.5}
              aria-hidden
            />
            <input
              id="candidate-search"
              type="search"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search name, title, company…"
              className="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-8 text-[13px] text-ink outline-none transition-all duration-120 placeholder:text-faint focus:border-ink focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--ink)_7%,transparent)]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => handleSearch("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-faint transition-colors hover:text-ink"
              >
                <X className="size-3.5" strokeWidth={1.75} aria-hidden />
              </button>
            )}
          </div>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery("")
                setSelectedSessionId(null)
                router.push(ROUTES.candidates)
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Candidate grid */}
      {candidatesLoading && !candidatesData ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-start gap-3">
                <Skeleton className="size-11 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Skeleton className="h-5 w-16 rounded-md" />
                <Skeleton className="h-5 w-20 rounded-md" />
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3.5">
                <Skeleton className="h-4 w-24 rounded-md" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : candidates.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface">
          <EmptyState
            icon={Users}
            title={hasFilters ? "No candidates match these filters" : "No candidates yet"}
            description={
              hasFilters
                ? "Try a different search term, switch stage, or clear the session filter."
                : "Create a hiring session to get an application link, then share it wherever you post the role."
            }
            action={
              hasFilters ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("")
                    setSelectedSessionId(null)
                    router.push(ROUTES.candidates)
                  }}
                >
                  Clear all filters
                </Button>
              ) : (
                <Button variant="action" size="sm" render={<Link href={ROUTES.dashboard} />}>
                  <Plus strokeWidth={2.25} />
                  Create a hiring session
                </Button>
              )
            }
          />
        </div>
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2">
            {candidates.map((candidate) => {
              const stage = candidate.current_status || "Applied"
              const score = candidate.match_score
              return (
                <li key={candidate.id}>
                  <article className="group relative h-full overflow-hidden rounded-xl border border-border bg-surface transition-all duration-150 hover:border-border-hover hover:shadow-md">
                    {/* Stage colour rail — double-coded with the badge below. */}
                    <span
                      aria-hidden
                      className={cn(
                        "absolute inset-y-0 left-0 w-[3px]",
                        stageDotClass(stage),
                      )}
                    />

                    <button
                      type="button"
                      onClick={() => handleViewCandidate(candidate)}
                      className="block w-full p-4 pl-5 text-left"
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative shrink-0">
                          <Avatar className="size-11">
                            <AvatarFallback className="font-data text-[12px] font-medium">
                              {getInitials(candidate.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          {score != null && score >= 85 && (
                            <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full border border-border bg-surface">
                              <Sparkles className="size-3 text-accent" strokeWidth={1.75} aria-hidden />
                              <span className="sr-only">Top match</span>
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-[14px] font-medium text-ink">
                            {candidate.full_name || "Unknown candidate"}
                          </h3>
                          <p className="mt-0.5 truncate text-[12px] text-muted">
                            {[candidate.current_title, candidate.current_company]
                              .filter(Boolean)
                              .join(" · ") || "No title on record"}
                          </p>
                        </div>
                      </div>

                      {(candidate.skills || []).length > 0 && (
                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          {(candidate.skills || []).slice(0, 3).map((skill, j) => (
                            <span
                              key={`${skill}-${j}`}
                              className="rounded-md border border-border bg-canvas px-2 py-0.5 text-[11px] text-muted"
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

                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                        {candidate.total_experience_years != null && (
                          <span className="flex items-center gap-1 text-[11px] text-muted">
                            <Briefcase className="size-3" strokeWidth={1.5} aria-hidden />
                            {candidate.total_experience_years}y
                          </span>
                        )}
                        {candidate.location && (
                          <span className="flex items-center gap-1 text-[11px] text-muted">
                            <MapPin className="size-3" strokeWidth={1.5} aria-hidden />
                            {candidate.location}
                          </span>
                        )}
                      </div>

                      <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-border pt-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <StageBadge stage={stage} size="sm" />
                          {candidate.flight_risk && (
                            <span
                              className={cn(
                                "shrink-0 font-data text-[11px]",
                                flightRiskTone(candidate.flight_risk),
                              )}
                            >
                              {candidate.flight_risk} flight risk
                            </span>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <div className="hidden text-right sm:block">
                            <p className={cn("font-data text-[12.5px] font-medium", getScoreTone(score))}>
                              {score != null ? `${Math.round(score)}%` : "—"}
                            </p>
                            <p className="text-[10px] text-faint">{getScoreLabel(score)}</p>
                          </div>
                          <div className="h-1 w-12 overflow-hidden rounded-full bg-track">
                            <div
                              className={cn("h-full rounded-full", getScoreBar(score))}
                              style={{ width: `${Math.max(0, Math.min(100, Math.round(score ?? 0)))}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </button>

                    {/* Row actions stay reachable by keyboard, not hover-only. */}
                    <div className="flex items-center gap-0.5 border-t border-border px-3 py-1.5">
                      {candidate.resume_file_url && (
                        <a
                          href={candidate.resume_file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex size-7 items-center justify-center rounded-md text-faint transition-colors duration-120 hover:bg-surface-secondary hover:text-ink"
                          aria-label={`Open ${candidate.full_name || "candidate"}'s resume`}
                        >
                          <FileText className="size-3.5" strokeWidth={1.75} aria-hidden />
                        </a>
                      )}

                      {stage.toLowerCase() === "offered" && (
                        <button
                          type="button"
                          onClick={() => handleHireClick(candidate)}
                          className="flex size-7 items-center justify-center rounded-md text-success transition-colors duration-120 hover:bg-success/10"
                          aria-label={`Mark ${candidate.full_name || "candidate"} as hired`}
                          title="Mark as hired"
                        >
                          <BadgeCheck className="size-3.5" strokeWidth={1.75} aria-hidden />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setEmailCandidate(candidate)}
                        disabled={!candidate.email}
                        title={
                          candidate.email
                            ? `Email ${candidate.full_name || "candidate"}`
                            : "No email address on file"
                        }
                        className="flex size-7 items-center justify-center rounded-md text-faint transition-colors duration-120 hover:bg-surface-secondary hover:text-ink disabled:opacity-35"
                        aria-label={`Email ${candidate.full_name || "candidate"}`}
                      >
                        <GmailLogo className="size-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleViewCandidate(candidate)}
                        className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-medium text-muted transition-colors duration-120 hover:bg-surface-secondary hover:text-ink"
                      >
                        <Eye className="size-3.5" strokeWidth={1.75} aria-hidden />
                        View profile
                      </button>
                    </div>
                  </article>
                </li>
              )
            })}
          </ul>

          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            summary={
              candidatesData?.total
                ? `Showing ${startRow}–${endRow} of ${candidatesData.total} candidates`
                : undefined
            }
          />
        </>
      )}

      <Dialog
        open={showHireConfirm}
        onOpenChange={(o) => {
          if (!o) {
            setShowHireConfirm(false)
            setHireCandidate(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <div className="px-6 pb-2 pt-6">
            <div className="mb-3 flex items-center gap-2 text-success">
              <BadgeCheck className="size-5" strokeWidth={1.75} aria-hidden />
              <h2 className="text-[15px] font-medium text-ink">Mark as hired</h2>
            </div>
            <p className="text-[13px] leading-relaxed text-muted">
              This records that{" "}
              <strong className="font-medium text-ink">
                {hireCandidate?.full_name || "this candidate"}
              </strong>{" "}
              accepted and started. Hired is a terminal stage — it cannot be undone from
              the pipeline.
            </p>
          </div>
          <div className="flex justify-end gap-2 px-6 pb-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowHireConfirm(false)
                setHireCandidate(null)
              }}
              disabled={hireLoading}
            >
              Cancel
            </Button>
            <Button variant="action" size="sm" onClick={confirmHire} disabled={hireLoading}>
              {hireLoading && <Loader2 className="animate-spin" />}
              Confirm hire
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
        candidate={selectedCandidate}
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
    <Suspense
      fallback={
        <div className="space-y-5">
          <div className="h-9 w-56 animate-pulse-soft rounded-lg bg-track" />
          <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[104px] rounded-xl" />
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[240px] rounded-xl" />
            ))}
          </div>
        </div>
      }
    >
      <CandidatesContent />
    </Suspense>
  )
}
