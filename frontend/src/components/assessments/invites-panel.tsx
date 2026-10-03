"use client"

import { useCallback, useEffect, useState, startTransition } from "react"
import { Copy, Loader2, Mail, RotateCcw, Ban, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { useApi } from "@/hooks/use-api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SearchInput } from "@/components/ui/search-input"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { EmptyState } from "@/components/ui/empty-state"
import { getInitials, formatDateTime } from "@/lib/constants"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { AssessmentDetail, EligibleCandidate, AssessmentInvite } from "@/lib/types"

export function InvitesPanel({ assessment }: { assessment: AssessmentDetail }) {
  const api = useApi()
  const published = assessment.status === "published"
  const [filter, setFilter] = useState<"eligible" | "all">("eligible")
  const [search, setSearch] = useState("")
  const [candidates, setCandidates] = useState<EligibleCandidate[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)
  const [invites, setInvites] = useState<AssessmentInvite[]>([])
  const [invitesLoading, setInvitesLoading] = useState(true)
  const [freshLinks, setFreshLinks] = useState<Array<{ candidateId: string; email: string; link: string }>>([])
  const [busyCandidate, setBusyCandidate] = useState<string | null>(null)

  const loadCandidates = useCallback(async () => {
    startTransition(() => setLoading(true))
    try {
      const res = await api.getEligibleCandidates(assessment.id, { filter, search: search || undefined, limit: 50 })
      if (res.success && res.data) {
        const rows = res.data.candidates
        const count = res.data.total
        startTransition(() => {
          setCandidates(rows)
          setTotal(count)
        })
      }
    } catch {
      toast.error("Failed to load candidates")
    } finally {
      startTransition(() => setLoading(false))
    }
  }, [api, assessment.id, filter, search])

  const loadInvites = useCallback(async () => {
    startTransition(() => setInvitesLoading(true))
    try {
      const res = await api.listInvites(assessment.id)
      if (res.success && res.data) startTransition(() => setInvites(res.data as AssessmentInvite[]))
    } catch {
      toast.error("Failed to load invitations")
    } finally {
      startTransition(() => setInvitesLoading(false))
    }
  }, [api, assessment.id])

  useEffect(() => {
    loadCandidates()
    loadInvites()
  }, [loadCandidates, loadInvites])

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSend = async () => {
    const ids = [...selected].filter((id) => {
      const c = candidates.find((x) => x.id === id)
      return c && !c.invite
    })
    if (ids.length === 0) {
      toast.error("Select at least one candidate without an existing invitation")
      return
    }
    setSending(true)
    try {
      const res = await api.sendInvites(assessment.id, ids)
      if (res.success && res.data) {
        const { invited, skippedAlreadyInvited, skippedMissingEmail } = res.data
        if (invited.length > 0) {
          toast.success(`${invited.length} invitation${invited.length === 1 ? "" : "s"} queued via Resend`)
          setFreshLinks(invited.map((i) => ({ candidateId: i.candidateId, email: i.email, link: i.link })))
        }
        if (skippedAlreadyInvited.length > 0) {
          toast.warning(`${skippedAlreadyInvited.length} already invited — no duplicate sent`)
        }
        if (skippedMissingEmail.length > 0) {
          toast.warning(`${skippedMissingEmail.length} skipped (no email address)`)
        }
        setSelected(new Set())
        loadCandidates()
        loadInvites()
      } else {
        toast.error(res.error || "Failed to send invitations")
      }
    } catch {
      toast.error("Failed to send invitations")
    } finally {
      setSending(false)
    }
  }

  const handleResend = async (candidateId: string) => {
    setBusyCandidate(candidateId)
    try {
      const res = await api.resendInvite(assessment.id, candidateId)
      if (res.success) {
        toast.success(`Invitation resent (#${res.data?.sendCount}) — same link reused`)
        loadCandidates()
        loadInvites()
      } else {
        toast.error(res.error || "Failed to resend")
      }
    } catch {
      toast.error("Failed to resend")
    } finally {
      setBusyCandidate(null)
    }
  }

  const handleRevoke = async (candidateId: string) => {
    setBusyCandidate(candidateId)
    try {
      const res = await api.revokeInvite(assessment.id, candidateId)
      if (res.success) {
        toast.success("Invitation revoked")
        loadCandidates()
        loadInvites()
      } else {
        toast.error(res.error || "Failed to revoke")
      }
    } catch {
      toast.error("Failed to revoke")
    } finally {
      setBusyCandidate(null)
    }
  }

  const copyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link)
      toast.success("Link copied")
    } catch {
      toast.error("Could not copy link")
    }
  }

  if (!published) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-center">
        <Mail className="mx-auto size-8 text-faint" />
        <p className="mt-2 text-sm font-medium text-ink">Publish first</p>
        <p className="mt-1 text-sm text-muted">
          Invitations can only be sent once the assessment is published.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {freshLinks.length > 0 && (
        <div className="rounded-lg border border-success/30 bg-success/5 p-4">
          <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
            <CheckCircle2 className="size-4 text-success" />
            Secure links (shown once — also emailed to candidates)
          </p>
          <div className="mt-2 space-y-1.5">
            {freshLinks.map((f) => (
              <div key={f.candidateId} className="flex items-center gap-2 rounded-md bg-surface px-3 py-2 text-xs">
                <span className="truncate text-muted">{f.email}</span>
                <button
                  onClick={() => copyLink(f.link)}
                  className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 font-medium text-ink hover:bg-surface-secondary"
                >
                  <Copy className="size-3" /> Copy link
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-4">
          <h3 className="text-sm font-medium text-ink">Eligible candidates</h3>
          <Badge variant="secondary">{total}</Badge>
          <div className="ml-1 flex gap-1">
            {(["eligible", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => { setFilter(f); setSelected(new Set()) }}
                className={`h-7 rounded-md px-2.5 text-xs font-medium transition-colors ${
                  filter === f ? "bg-ink text-canvas" : "text-muted hover:bg-surface-secondary hover:text-ink"
                }`}
                title={f === "eligible" ? "Shortlisted + Screening (default)" : "All your candidates — pick manually"}
              >
                {f === "eligible" ? "Shortlisted" : "All"}
              </button>
            ))}
          </div>
          <div className="ml-auto flex w-full gap-2 sm:w-auto">
            <SearchInput value={search} onChange={setSearch} placeholder="Search candidates..." />
            <Button size="sm" className="shrink-0 bg-ink text-canvas hover:bg-ink/90" onClick={handleSend} disabled={sending || selected.size === 0}>
              {sending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Send ({selected.size})
            </Button>
          </div>
        </div>
        {loading ? (
          <p className="p-6 text-center text-sm text-muted">Loading candidates…</p>
        ) : candidates.length === 0 ? (
          <EmptyState
            icon={Mail}
            title={filter === "eligible" ? "No shortlisted candidates" : "No candidates found"}
            description={filter === "eligible" ? "Switch to “All” to pick any candidate manually." : "Try a different search term."}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Invitation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((c) => {
                  const invited = Boolean(c.invite)
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selected.has(c.id)}
                          disabled={invited}
                          onChange={() => toggleSelect(c.id)}
                          aria-label={`Select ${c.full_name || c.email}`}
                          className="size-4 accent-primary disabled:opacity-30"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs bg-surface-secondary text-muted">
                              {getInitials(c.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium text-ink">{c.full_name || "Unknown"}</p>
                            <p className="text-xs text-faint">{c.email || "No email"}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{c.current_status || "—"}</Badge>
                      </TableCell>
                      <TableCell>
                        {c.invite ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                            <Badge variant={c.invite.status === "revoked" ? "destructive" : "success"}>
                              {c.invite.status === "revoked" ? "Revoked" : `Sent ×${c.invite.send_count}`}
                            </Badge>
                            <span className="text-faint">{formatDateTime(c.invite.last_sent_at)}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-faint">Not invited</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-surface">
        <div className="border-b border-border p-4">
          <h3 className="text-sm font-medium text-ink">Sent invitations</h3>
          <p className="text-xs text-faint">Resend reuses the same link and increments the counter. Revoked links stop working.</p>
        </div>
        {invitesLoading ? (
          <p className="p-6 text-center text-sm text-muted">Loading invitations…</p>
        ) : invites.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">No invitations sent yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((inv) => {
                  const busy = busyCandidate === inv.candidate_id
                  const revoked = inv.status === "revoked"
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <p className="text-sm font-medium text-ink">
                          {inv.candidates?.full_name || "Candidate"}
                        </p>
                        <p className="text-xs text-faint">{inv.email}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={revoked ? "destructive" : "success"}>
                          {revoked ? "Revoked" : `Sent ×${inv.send_count}`}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-faint">{formatDateTime(inv.last_sent_at)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!revoked && (
                            <>
                              <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs" onClick={() => handleResend(inv.candidate_id)} disabled={busy}>
                                {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5 mr-1" />}
                                Resend
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs text-danger hover:text-danger hover:bg-danger/10" onClick={() => handleRevoke(inv.candidate_id)} disabled={busy}>
                                <Ban className="h-3.5 w-3.5 mr-1" />
                                Revoke
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
