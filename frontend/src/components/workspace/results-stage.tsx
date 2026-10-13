"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { FileText, Loader2, Plus, Ban } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ScoreRing } from "@/components/ui/score-ring"
import { StageBadge } from "@/components/ui/stage-badge"
import { Select } from "@/components/ui/select"
import { AssessmentStateBadge } from "@/components/workspace/assessment-state-badge"
import { useApi } from "@/hooks/use-api"
import { ROUTES } from "@/lib/constants"
import type { AssessmentState, WorkspaceCandidate, WorkspacePayload } from "@/lib/types"

/**
 * Stage 4 — Results and reports.
 *
 * The recruiter sees completion status here the moment a submission is
 * persisted, and can open that candidate's report. The report is built from
 * real `assessment_attempts` / `assessment_answers` rows; nothing is estimated.
 */
export function ResultsStage({ workspace, onChanged }: { workspace: WorkspacePayload; onChanged: () => void }) {
  const api = useApi()
  const [filter, setFilter] = useState<AssessmentState | "all" | "with_results">("all")
  const [busy, setBusy] = useState<string | null>(null)

  const { job, pipeline, counts } = workspace

  // Only candidates who actually have an assessment row, or are past it.
  const rows = useMemo(() => {
    const base = pipeline.filter((r) => r.assessment !== null && r.assessment.state !== "not_created")
    switch (filter) {
      case "all":
        return base
      case "with_results":
        return base.filter((r) => r.assessment?.state === "completed")
      default:
        return base.filter((r) => r.assessment?.state === filter)
    }
  }, [pipeline, filter])

  async function generateReport(row: WorkspaceCandidate) {
    setBusy(row.candidateId)
    try {
      const res = await api.generateReport(row.candidateId, {
        reportType: "internal",
        jobId: job.id,
        sendEmail: false,
      })
      if (!res.success) throw new Error(res.error || "Could not generate the report")
      toast.success("Report ready", { description: "Built from the persisted assessment result." })
      onChanged()
    } catch (err) {
      toast.error("Could not generate report", {
        description: err instanceof Error ? err.message : "Unexpected error",
      })
    } finally {
      setBusy(null)
    }
  }

  const filters: Array<{ value: typeof filter; label: string; count: number }> = [
    { value: "all", label: "All", count: rows.length },
    { value: "invited", label: "Invited", count: counts.invited },
    { value: "in_progress", label: "In progress", count: counts.inProgress },
    { value: "completed", label: "Completed", count: counts.completed },
    { value: "failed", label: "Failed", count: counts.failed },
    { value: "expired", label: "Expired", count: counts.expired },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            aria-pressed={filter === f.value}
            className={
              filter === f.value
                ? "rounded-full bg-surface-secondary px-3 py-1.5 text-[12px] font-medium text-ink"
                : "rounded-full px-3 py-1.5 text-[12px] text-muted transition-colors duration-120 hover:text-ink"
            }
          >
            {f.label}
            {f.count > 0 && <span className="font-data ml-1.5 text-[11px] text-faint">{f.count}</span>}
          </button>
        ))}
        <div className="ml-auto">
          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="sr-only"
            wrapperClassName="hidden"
            aria-label="Result status"
          >
            <option value="all">All</option>
          </Select>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No assessment results yet"
          description="Once a shortlisted candidate opens their link and submits, their score, attempt status and report appear here."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-[0.06em] text-faint">
                <th scope="col" className="px-4 py-2.5 font-medium">Candidate</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Score</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Submitted</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Stage</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Report</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const a = row.assessment
                return (
                  <tr key={row.applicationId} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`${ROUTES.candidateDetail(row.candidateId)}?job=${job.id}`}
                        className="text-[13px] font-medium text-ink hover:underline"
                      >
                        {row.fullName || "Unnamed candidate"}
                      </Link>
                      {a?.assessmentName && (
                        <p className="mt-0.5 text-[11.5px] text-faint">{a.assessmentName}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <AssessmentStateBadge state={a?.state ?? "not_created"} version={a?.snapshotVersion} />
                    </td>
                    <td className="px-4 py-3">
                      {a?.percentage != null ? (
                        <div className="flex items-center gap-2">
                          <ScoreRing value={a.percentage} size={34} />
                          <div>
                            <span className="font-data text-[12.5px] text-ink">
                              {a.score}/{a.maxScore}
                            </span>
                            <p
                              className={`text-[11px] ${a.passed ? "text-success" : "text-danger"}`}
                            >
                              {a.passed ? "Pass" : "Not passed"}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-[12px] text-faint">Not submitted</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-data text-[11.5px] text-muted">
                      {a?.submittedAt ? new Date(a.submittedAt).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StageBadge stage={row.stage} showDot />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.hasReport ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2.5 text-xs"
                          render={<Link href={`${ROUTES.candidateDetail(row.candidateId)}?job=${job.id}&tab=hiring`} />}
                        >
                          <FileText size={13} aria-hidden />
                          View report
                        </Button>
                      ) : a?.state === "completed" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2.5 text-xs"
                          disabled={busy === row.candidateId}
                          onClick={() => generateReport(row)}
                        >
                          {busy === row.candidateId ? (
                            <Loader2 size={13} className="animate-spin" aria-hidden />
                          ) : (
                            <Plus size={13} aria-hidden />
                          )}
                          Generate
                        </Button>
                      ) : (
                        <span className="text-[12px] text-faint">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/** Banner shown when a job is closed but the recruiter is browsing history. */
export function ClosedJobBanner({ title }: { title: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-[8px] border border-warning/25 bg-warning/10 px-3 py-2.5">
      <Ban size={14} className="mt-0.5 shrink-0 text-warning" aria-hidden />
      <p className="text-[12.5px] leading-relaxed text-warning">
        <strong className="font-medium">{title}</strong> is closed. Every candidate, score,
        interview and report below is preserved and readable, but no new applications, invitations
        or stage changes can be made until it is reopened.
      </p>
    </div>
  )
}