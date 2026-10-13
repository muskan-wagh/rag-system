"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Link2, Mail, RotateCcw, Send, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { ScoreRing } from "@/components/ui/score-ring"
import {
  AssessmentStateBadge,
  DeliveryBadge,
} from "@/components/workspace/assessment-state-badge"
import { useApi } from "@/hooks/use-api"
import { stageRank } from "@/lib/pipeline"
import type { InviteResult, WorkspaceCandidate, WorkspacePayload } from "@/lib/types"

/**
 * Stage 3 — Assessment invitations.
 *
 * Only candidates SHORLISTED on this job are listed, because that is the only
 * state in which a recruiter has actually decided this person should take the
 * assessment. Sending is always an explicit action: nothing is emailed
 * automatically because someone was shortlisted.
 *
 * The delivery badge reflects what the provider really did. An unconfigured or
 * failing Resend shows as Failed, not Sent.
 */
export function InvitationsStage({
  workspace,
  onChanged,
}: {
  workspace: WorkspacePayload
  onChanged: () => void
}) {
  const api = useApi();;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [confirm, setConfirm] = useState(false)
  const [links, setLinks] = useState<Array<{ email: string; link: string }>>([])

  const { job, assessments, readOnly, invitesAllowedWhenClosed } = workspace

  const eligible = useMemo(
    () => workspace.pipeline.filter((row) => stageRank(row.stage) <= stageRank("Shortlisted")),
    [workspace.pipeline],
  )

  const published = assessments.find((a) => a.status === "published")
  const notSent = eligible.filter(
    (row) => row.assessment?.state === "not_created" || row.assessment?.state === "ready_to_send",
  )

  const sendable = notSent.filter((row) => Boolean(row.email?.trim()))
  const noEmail = notSent.filter((row) => !row.email?.trim())

  const blockedReason = readOnly && !invitesAllowedWhenClosed
    ? `"${job.title}" is closed. Reopen it, or enable "Allow assessment invitations on closed jobs" in this job's settings.`
    : !published
      ? "Publish this job's assessment before sending invitations."
      : null

  function toggle(candidateId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(candidateId)) next.delete(candidateId)
      else next.add(candidateId)
      return next
    })
  }

  async function send() {
    if (!published) return
    setSending(true)
    try {
      const res = await api.sendInvites(published.id, Array.from(selected))
      if (!res.success) throw new Error(res.error || "Could not send invitations")

      const data = res.data as InviteResult

      setLinks(data.invited.map((i) => ({ email: i.email, link: i.link })))

      const parts: string[] = []
      if (data.invited.length) parts.push(`${data.invited.length} invitation(s) queued.`)
      if (data.skippedAlreadyInvited.length) {
        parts.push(`${data.skippedAlreadyInvited.length} already had an active invitation.`)
      }
      if (data.skippedMissingEmail.length) parts.push(`${data.skippedMissingEmail.length} had no email address.`)
      if (data.failed.length) parts.push(`${data.failed.length} failed.`)

      if (data.failed.length && !data.invited.length) {
        toast.error("No invitations were sent", { description: data.failed[0]?.reason })
      } else {
        toast.success("Invitations queued", {
          description: `${parts.join(" ")} Pinned to version ${data.snapshotVersion}. Delivery status updates below.`,
        })
      }

      setSelected(new Set())
      setConfirm(false)
      onChanged()
    } catch (err) {
      toast.error("Could not send invitations", {
        description: err instanceof Error ? err.message : "Unexpected error",
      })
    } finally {
      setSending(false)
    }
  }

  async function resend(row: WorkspaceCandidate) {
    if (!published) return
    setBusy(row.candidateId)
    try {
      const res = await api.resendInvite(published.id, row.candidateId)
      if (!res.success) throw new Error(res.error || "Could not resend")
      const data = res.data as { sendCount: number; deliveryStatus?: string; error?: string }
      if (data.deliveryStatus === "failed") {
        toast.error("Resend failed", { description: data.error ?? "The email provider rejected it." })
      } else {
        toast.success("Invitation resent", {
          description: `Send #${data.sendCount}. The link and its pinned version are unchanged.`,
        })
      }
      onChanged()
    } catch (err) {
      toast.error("Could not resend", {
        description: err instanceof Error ? err.message : "Unexpected error",
      })
    } finally {
      setBusy(null)
    }
  }

  if (eligible.length === 0) {
    return (
      <EmptyState
        icon={Mail}
        title="Nobody is eligible for an assessment yet"
        description="Shortlist a candidate from the Shortlisting tab and they will appear here, ready to invite."
      />
    )
  }

  return (
    <div className="space-y-4">
      {blockedReason && (
        <p className="rounded-[8px] border border-warning/25 bg-warning/10 px-3 py-2 text-[12px] text-warning">
          {blockedReason}
        </p>
      )}

      {links.length > 0 && (
        <div className="rounded-[8px] border border-info/25 bg-info/10 p-3">
          <p className="text-[12px] font-medium text-info">
            Secure links (shown once — they are never emailed in full again)
          </p>
          <ul className="mt-2 space-y-1.5">
            {links.map((l) => (
              <li key={l.email} className="flex flex-wrap items-center gap-2">
                <span className="text-[12px] text-ink">{l.email}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard
                      ?.writeText(l.link)
                      .then(() => toast.success("Link copied"))
                      .catch(() => toast.error("Could not copy the link"))
                  }}
                  className="font-data inline-flex items-center gap-1 rounded-[6px] border border-border bg-surface px-2 py-1 text-[11px] text-muted hover:text-ink"
                >
                  <Link2 size={11} aria-hidden />
                  Copy link
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-[12.5px] text-muted">
          {selected.size > 0
            ? `${selected.size} selected`
            : `${sendable.length} ready to send${noEmail.length ? ` · ${noEmail.length} missing an email` : ""}`}
        </p>
        <Button
          variant="action"
          size="sm"
          className="h-8 px-3 text-xs"
          disabled={selected.size === 0 || Boolean(blockedReason)}
          onClick={() => setConfirm(true)}
        >
          <Send size={13} aria-hidden />
          Send {selected.size > 0 ? `(${selected.size})` : ""}
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-[0.06em] text-faint">
              <th scope="col" className="w-9 px-3 py-2.5" />
              <th scope="col" className="px-4 py-2.5 font-medium">Candidate</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Screening</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Assessment</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Email</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {eligible.map((row) => {
              const state = row.assessment?.state ?? "not_created"
              const canSelect =
                (state === "not_created" || state === "ready_to_send") &&
                Boolean(row.email?.trim()) &&
                !blockedReason
              return (
                <tr key={row.applicationId} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      className="size-3.5 accent-[var(--color-ink)]"
                      checked={selected.has(row.candidateId)}
                      disabled={!canSelect}
                      onChange={() => toggle(row.candidateId)}
                      aria-label={`Select ${row.fullName}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[13px] font-medium text-ink">
                      {row.fullName || "Unnamed candidate"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {row.screening ? (
                      <ScoreRing value={row.screening.overall} size={32} />
                    ) : (
                      <span className="text-[12px] text-faint">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <AssessmentStateBadge
                      state={state}
                      version={row.assessment?.snapshotVersion}
                    />
                  </td>
                  <td className="px-4 py-3">
                    {row.assessment?.deliveryStatus ? (
                      <div className="flex flex-col items-start gap-1">
                        <DeliveryBadge status={row.assessment.deliveryStatus} />
                        {row.assessment.sentAt && (
                          <span className="font-data text-[10.5px] text-faint">
                            {new Date(row.assessment.sentAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                    ) : row.email ? (
                      <span className="text-[12px] text-faint">Not sent</span>
                    ) : (
                      <span className="text-[12px] text-danger">No email address</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.assessment?.inviteStatus && row.assessment.inviteStatus !== "revoked" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2.5 text-xs"
                        disabled={Boolean(blockedReason) || busy === row.candidateId}
                        onClick={() => resend(row)}
                      >
                        {busy === row.candidateId ? (
                          <Loader2 size={13} className="animate-spin" aria-hidden />
                        ) : (
                          <RotateCcw size={13} aria-hidden />
                        )}
                        Resend
                      </Button>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent className="max-w-md">
          <div className="px-6 pt-6">
            <h2 className="text-[16px] font-medium text-ink">
              Send {selected.size} invitation{selected.size === 1 ? "" : "s"}?
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              Each candidate receives a unique, secure link scoped to them and to{" "}
              <strong className="text-ink">{job.title}</strong>. Links are never shared, and the
              assessment is pinned to version {published?.snapshotVersion ?? "—"}.
            </p>
          </div>
          <div className="flex justify-end gap-2 px-6 pb-6 pt-5">
            <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button variant="action" size="sm" onClick={send} disabled={sending}>
              {sending && <Loader2 size={13} className="animate-spin" aria-hidden />}
              Send invitations
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}