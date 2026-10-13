"use client"

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { BadgeCheck, CircleX, Gavel, Loader2, PauseCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { StageBadge } from "@/components/ui/stage-badge";
import { useApi } from "@/hooks/use-api";
import { ROUTES } from "@/lib/constants";
import type { DecisionResult, WorkspaceCandidate, WorkspacePayload } from "@/lib/types";

/**
 * Stage 6 — Interview & decision.
 *
 * The recruiter makes the call. A passing score may inform it, but nothing here
 * advances automatically: the only automation available is an explicit, opt-in
 * per-job rule, off by default.
 */
export function InterviewDecisionStage({
  workspace,
  onChanged,
}: {
  workspace: WorkspacePayload
  onChanged: () => void
}) {
  const api = useApi();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    row: WorkspaceCandidate;
    decision: "Hold" | "Rejected" | "Final Decision";
  } | null>(null);
  const [reason, setReason] = useState("");

  const { job, readOnly } = workspace;

  const rows = useMemo(
    () =>
      workspace.pipeline.filter((r) =>
        ["Technical Round", "Interview", "Final Decision", "Hold"].includes(r.stage),
      ),
    [workspace.pipeline],
  );

  async function apply(
    row: WorkspaceCandidate,
    decision: "Interview" | "Final Decision" | "Hold" | "Rejected",
    why?: string,
  ) {
    if (readOnly) {
      toast.error(`"${job.title}" is closed. Reopen it to change decisions.`);
      return;
    }
    setBusy(row.candidateId);
    try {
      const res = await api.decide(job.id, row.candidateId, {
        decision,
        reason: why,
        ...(row.assessment?.percentage != null
          ? { percentage: row.assessment.percentage, passed: row.assessment.passed ?? undefined }
          : {}),
      });
      if (!res.success) throw new Error(res.error || "Could not record the decision");
      const data = res.data as DecisionResult
      if (data.deduplicated && !data.changed) {
        toast.message("Already recorded", { description: data.message })
      } else {
        toast.success(`Moved to ${decision}`, { description: data.message })
      }
      setConfirm(null)
      setReason("")
      onChanged()
    } catch (err) {
      toast.error("Could not record the decision", {
        description: err instanceof Error ? err.message : "Unexpected error",
      })
    } finally {
      setBusy(null)
    }
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Gavel}
        title="No interviews to review"
        description="Candidates reach this stage after the technical round. Review feedback here, then hire or reject."
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
              <th scope="col" className="px-4 py-2.5 font-medium">Stage</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Assessment</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Report</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Decision</th>
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
                <td className="px-4 py-3">
                  <StageBadge stage={row.stage} showDot />
                </td>
                <td className="px-4 py-3 font-data text-[12.5px] text-muted">
                  {row.assessment?.percentage != null ? `${row.assessment.percentage}%` : "—"}
                </td>
                <td className="px-4 py-3">
                  {row.hasReport ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2.5 text-xs"
                      render={
                        <Link href={`${ROUTES.candidateDetail(row.candidateId)}?job=${job.id}&tab=hiring`} />
                      }
                    >
                      Review
                    </Button>
                  ) : (
                    <span className="text-[12px] text-faint">Not generated</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1.5">
                    {row.stage === "Technical Round" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2.5 text-xs"
                        disabled={readOnly || busy === row.candidateId}
                        onClick={() => apply(row, "Interview")}
                      >
                        {busy === row.candidateId && (
                          <Loader2 size={13} className="animate-spin" aria-hidden />
                        )}
                        Move to Interview
                      </Button>
                    )}
                    {row.stage === "Interview" && (
                      <Button
                        variant="action"
                        size="sm"
                        className="h-8 px-2.5 text-xs"
                        disabled={readOnly || busy === row.candidateId}
                        onClick={() => apply(row, "Final Decision")}
                      >
                        Ready for decision
                      </Button>
                    )}
                    {row.stage !== "Hold" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2.5 text-xs"
                        disabled={readOnly || busy === row.candidateId}
                        onClick={() => {
                          setConfirm({ row, decision: "Hold" })
                          setReason("")
                        }}
                      >
                        <PauseCircle size={13} aria-hidden />
                        Hold
                      </Button>
                    )}
                    {row.stage !== "Rejected" && (
                      <Button
                        variant="destructive-ghost"
                        size="sm"
                        className="h-8 px-2.5 text-xs"
                        disabled={readOnly || busy === row.candidateId}
                        onClick={() => {
                          setConfirm({ row, decision: "Rejected" })
                          setReason("")
                        }}
                      >
                        <CircleX size={13} aria-hidden />
                        Reject
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="max-w-md">
          <div className="px-6 pt-6">
            <h2 className="flex items-center gap-2 text-[16px] font-medium text-ink">
              {confirm?.decision === "Rejected" ? (
                <CircleX size={16} className="text-danger" aria-hidden />
              ) : (
                <PauseCircle size={16} className="text-warning" aria-hidden />
              )}
              {confirm?.decision === "Rejected" ? "Reject" : "Hold"}{" "}
              {confirm?.row.fullName}?
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              This applies to{" "}
              <strong className="text-ink">{job.title}</strong> only. Their assessment scores,
              report and full history are kept, and the decision is recorded against your account.
            </p>
            <div className="mt-4">
              <label htmlFor="decision-reason" className="text-[12px] font-medium text-ink">
                Reason <span className="font-normal text-faint">(optional, kept in their history)</span>
              </label>
              <Textarea
                id="decision-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="mt-1.5"
                placeholder={
                  confirm?.decision === "Rejected"
                    ? "Why is this candidate not progressing?"
                    : "What would you like to revisit?"
                }
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 px-6 pb-6 pt-4">
            <Button variant="ghost" size="sm" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant={confirm?.decision === "Rejected" ? "destructive" : "action"}
              size="sm"
              disabled={busy === confirm?.row.candidateId}
              onClick={() =>
                confirm && apply(confirm.row, confirm.decision, reason || undefined)
              }
            >
              {busy === confirm?.row.candidateId && (
                <Loader2 size={13} className="animate-spin" aria-hidden />
              )}
              {confirm?.decision === "Rejected" ? (
                <>
                  <CircleX size={13} aria-hidden />
                  Reject
                </>
              ) : (
                <>
                  <PauseCircle size={13} aria-hidden />
                  Hold
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <p className="flex items-start gap-2 text-[11.5px] text-faint">
        <BadgeCheck size={13} className="mt-0.5 shrink-0" aria-hidden />
        A passing assessment score informs your decision but never makes it. Hiring is always a
        recruiter action.
      </p>
    </div>
  )
}