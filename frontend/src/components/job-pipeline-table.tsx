"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowUpRight, Users } from "lucide-react"

import { useApi } from "@/hooks/use-api"
import { getInitials, ROUTES } from "@/lib/constants"
import { AvatarExtended, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { SearchInput } from "@/components/ui/search-input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"

/**
 * The job's candidate pipeline.
 *
 * Backed by `GET /jobs/:jobId/candidates`, which reads the authoritative
 * `job_applications` table — so the same person can never appear twice for a
 * job, and every row reflects a real persisted stage rather than an inferred
 * one.
 *
 * Loading, empty and error states are all rendered explicitly; nothing here
 * fabricates data.
 */

interface PipelineRow {
  candidate_id: string
  stage: string
  source: string
  applied_at: string
  full_name: string | null
  current_title: string | null
  current_company: string | null
  resume_file_url: string | null
}

/** Canonical stages in pipeline order. Mirrors the backend transition matrix. */
const STAGE_ORDER = [
  "Applied", "Screening", "Assessment", "Technical Interview",
  "Managerial/HR", "Offer", "Hired", "Hold", "Rejected", "Withdrawn",
] as const

/** Stage → badge tone. Keeps status colour consistent with the rest of the app. */
function stageVariant(stage: string) {
  switch (stage) {
    case "Hired": return "success" as const
    case "Rejected":
    case "Withdrawn": return "destructive" as const
    case "Hold":
    case "Offer": return "warning" as const
    default: return "secondary" as const
  }
}

const PAGE_SIZE = 25

export function JobPipelineTable({ jobId }: { jobId: string }) {
  const api = useApi()
  const [rows, setRows] = useState<PipelineRow[]>([])
  const [total, setTotal] = useState(0)
  const [query, setQuery] = useState("")
  const [stage, setStage] = useState<string>("all")
  const [page, setPage] = useState(0)
  const [state, setState] = useState<"loading" | "ready" | "error">("loading")
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setState((s) => (s === "ready" ? "ready" : "loading"))
    try {
      const res = await api.getJobCandidates(jobId, {
        stage: stage === "all" ? undefined : stage,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      })
      if (!res.success) {
        setError(res.error || "Could not load the pipeline")
        setState("error")
        return
      }
      const data = res.data as { candidates: PipelineRow[]; total: number } | undefined
      setRows(data?.candidates ?? [])
      setTotal(data?.total ?? 0)
      setError(null)
      setState("ready")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the pipeline")
      setState("error")
    }
  }, [api, jobId, stage, page])

  useEffect(() => {
    // Deferred to a microtask so setState happens in an async callback
    // (react-hooks/set-state-in-effect), matching the job page convention.
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  // Client-side name filter keeps the table responsive without another round trip.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) =>
      [r.full_name, r.current_title, r.current_company]
        .some((v) => (v || "").toLowerCase().includes(q)),
    )
  }, [rows, query])

  const usedStages = useMemo(
    () => STAGE_ORDER.filter((s) => rows.some((r) => r.stage === s)),
    [rows],
  )

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  if (state === "error") {
    return (
      <div className="rounded-lg border border-border bg-surface p-6">
        <EmptyState
          icon={AlertTriangle}
          title="Could not load the pipeline"
          description={error || "Something went wrong fetching this job's candidates."}
          action={<Button variant="outline" size="sm" onClick={() => void load()}>Retry</Button>}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          value={query}
          onChange={(value) => setQuery(value)}
          placeholder="Search name, title, company"
          aria-label="Search pipeline"
          className="sm:max-w-xs"
        />
        {/* Stage chips read from real rows, so an empty filter never lies. */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => { setStage("all"); setPage(0) }}
            className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
              stage === "all"
                ? "border-border bg-surface-secondary text-text-secondary"
                : "border-transparent text-text-muted hover:bg-surface-secondary"
            }`}
          >
            All
          </button>
          {usedStages.map((s) => (
            <button
              key={s}
              onClick={() => { setStage(s); setPage(0) }}
              className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                stage === s
                  ? "border-border bg-surface-secondary text-text-secondary"
                  : "border-transparent text-text-muted hover:bg-surface-secondary"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface">
        {state === "loading" ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Users}
            title={query ? "No matches" : "No candidates in this job yet"}
            description={
              query
                ? `Nothing matches “${query}” in the current page.`
                : stage === "all"
                  ? "Upload resumes against this job and candidates will appear here with a real stage."
                  : `No candidates are currently in ${stage}.`
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead className="hidden md:table-cell">Current role</TableHead>
                <TableHead className="hidden sm:table-cell">Applied</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((r) => (
                <TableRow key={r.candidate_id}>
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-2.5">
                      <AvatarExtended size="sm">
                        <AvatarFallback>{getInitials(r.full_name ?? undefined)}</AvatarFallback>
                      </AvatarExtended>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-ink">
                          {r.full_name || "Unnamed candidate"}
                        </span>
                        {r.current_company ? (
                          <span className="block truncate text-xs text-muted">{r.current_company}</span>
                        ) : null}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={stageVariant(r.stage)}>{r.stage ?? "Applied"}</Badge>
                  </TableCell>
                  <TableCell className="hidden text-[13px] text-text-secondary md:table-cell">
                    {r.current_title || "—"}
                  </TableCell>
                  <TableCell className="hidden font-data text-xs text-muted sm:table-cell">
                    {r.applied_at ? r.applied_at.slice(0, 10) : "—"}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={ROUTES.candidateDetail(r.candidate_id)}
                      aria-label={`Open ${r.full_name || "candidate"}`}
                      className="inline-flex items-center text-text-muted transition-colors hover:text-ink"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {pageCount > 1 ? (
        <div className="flex items-center justify-between text-xs text-muted">
          <span>
            Page {page + 1} of {pageCount} · {total} candidate{total === 1 ? "" : "s"}
          </span>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}