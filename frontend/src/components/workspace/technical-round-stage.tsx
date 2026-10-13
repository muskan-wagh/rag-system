"use client"

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CalendarDays, Loader2, MonitorPlay } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StageBadge } from "@/components/ui/stage-badge";
import { ScheduleInterviewModal } from "@/components/schedule-interview-modal";
import { useApi } from "@/hooks/use-api";
import { ROUTES } from "@/lib/constants";
import type { WorkspaceCandidate, WorkspacePayload } from "@/lib/types";

/**
 * Stage 5 — Technical round.
 *
 * Coding lives here rather than as a separate section: it is a 1:1 child of an
 * interview row (`interview_coding_sessions.interview_id` is the primary key),
 * so it cannot exist independently of a scheduled technical interview. Presenting
 * it as its own stage would mean two records for one event.
 *
 * Advancing a candidate is an explicit recruiter action. A passing assessment
 * score informs the decision; it never makes it.
 */
export function TechnicalRoundStage({
  workspace,
  onChanged,
}: {
  workspace: WorkspacePayload
  onChanged: () => void
}) {
  const api = useApi();;
  const [busy, setBusy] = useState<string | null>(null);
  const [scheduleFor, setScheduleFor] = useState<WorkspaceCandidate | null>(null);

  const { job, readOnly } = workspace;

  const rows = useMemo(
    () =>
      workspace.pipeline.filter(
        (r) => r.stage === "Assessment" || r.stage === "Technical Round",
      ),
    [workspace.pipeline],
  );

  async function advance(row: WorkspaceCandidate) {
    if (readOnly) {
      toast.error(`"${job.title}" is closed. Reopen it to move candidates.`);
      return;
    }
    setBusy(row.candidateId);
    try {
      const res = await api.decide(job.id, row.candidateId, {
        decision: "Technical Round",
        ...(row.assessment?.percentage != null
          ? {
              percentage: row.assessment.percentage,
              passed: row.assessment.passed ?? undefined,
              assessmentId: row.assessment.assessmentId ?? undefined,
            }
          : {}),
      });
      if (!res.success) throw new Error(res.error || "Could not advance the candidate");
      const data = res.data as { changed: boolean; deduplicated: boolean; message: string };
      if (data.deduplicated && !data.changed) {
        toast.message("Already advanced", { description: data.message });
      } else {
        toast.success("Moved to Technical round", {
          description: "An interview slot and a secure invitation link were created.",
        });
      }
      onChanged()
    } catch (err) {
      toast.error("Could not advance", {
        description: err instanceof Error ? err.message : "Unexpected error",
      });
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Nobody waiting on a technical round"
        description="Candidates appear here once they have completed the assessment. Review their report, then advance them."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-[0.06em] text-faint">
              <th scope="col" className="px-4 py-2.5 font-medium">Candidate</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Assessment</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Stage</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Interview</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.applicationId} className="border-b border-border last:border-b-0">
                <td className="px-4 py-3">
                  <Link
                    href={`${ROUTES.candidateDetail(row.candidateId)}?job=${job.id}`}
                    className="text-[13px] font-medium text-ink hover:underline"
                  >
                    {row.fullName || "Unnamed candidate"}
                  </Link>
                </td>
                <td className="px-4 py-3 font-data text-[12.5px] text-ink">
                  {row.assessment?.percentage != null ? (
                    <>
                      {row.assessment.percentage}% ·{" "}
                      <span className={row.assessment.passed ? "text-success" : "text-danger"}>
                        {row.assessment.passed ? "Pass" : "Not passed"}
                      </span>
                    </>
                  ) : (
                    <span className="text-faint">Not completed</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StageBadge stage={row.stage} showDot />
                </td>
                <td className="px-4 py-3 font-data text-[11.5px] text-muted">
                  {row.interview ? (
                    <>
                      {row.interview.scheduledDate} {row.interview.scheduledTime}
                      <span className="ml-1.5 text-faint">({row.interview.status})</span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1.5">
                    {row.interview && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2.5 text-xs"
                        render={<Link href={`${ROUTES.candidateDetail(row.candidateId)}?job=${job.id}&tab=hiring`} />}
                      >
                        <MonitorPlay size={13} aria-hidden />
                        Live coding
                      </Button>
                    )}
                    {row.stage === "Technical Round" && !row.interview && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2.5 text-xs"
                        disabled={readOnly}
                        onClick={() => setScheduleFor(row)}
                      >
                        <CalendarDays size={13} aria-hidden />
                        Schedule
                      </Button>
                    )}
                    {row.stage === "Assessment" && (
                      <Button
                        variant="action"
                        size="sm"
                        className="h-8 px-2.5 text-xs"
                        disabled={readOnly || busy === row.candidateId}
                        onClick={() => advance(row)}
                      >
                        {busy === row.candidateId && (
                          <Loader2 size={13} className="animate-spin" aria-hidden />
                        )}
                        Move to Technical round
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {scheduleFor && (
        <ScheduleInterviewModal
          open
          candidateId={scheduleFor.candidateId}
          onClose={() => setScheduleFor(null)}
          onSuccess={() => {
            setScheduleFor(null)
            toast.success("Interview scheduled", {
              description: "The candidate has been invited and now appears in the interview stage.",
            })
            onChanged()
          }}
        />
      )}
    </div>
  )
}