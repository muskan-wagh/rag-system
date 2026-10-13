"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Briefcase, Loader2, Lock, Unlock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input, Field } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useApi } from "@/hooks/use-api"
import type { MinimalJob, WorkspacePayload } from "@/lib/types"

/**
 * Jobs tab.
 *
 * The standalone `/jobs` page was removed and job management moved here, so the
 * recruiter never has to leave the workspace to open, close or edit a role.
 *
 * Closing a job stops NEW recruitment activity. It does not delete anything —
 * candidates, screening results, assessments, attempts, interviews and reports
 * all remain, and the workspace stays readable in read-only mode.
 */
export function JobsTab({
  jobs,
  workspace,
  onJobSelected,
  onChanged,
}: {
  jobs: MinimalJob[]
  workspace: WorkspacePayload | null
  onJobSelected: (jobId: string) => void
  onChanged: () => void
}) {
  const api = useApi()
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmClose, setConfirmClose] = useState<MinimalJob | null>(null)
  const [configOpen, setConfigOpen] = useState(false)

  const config = workspace?.job.id
    ? (jobs.find((j) => j.id === workspace.job.id)?.progression_config ?? {})
    : {}

  async function create() {
    if (!title.trim()) {
      toast.error("Give the role a title")
      return
    }
    setBusy("create")
    try {
      const res = await api.createJob({ title: title.trim(), description: description.trim() || undefined })
      if (!res.success) throw new Error(res.error || "Could not create the job")
      toast.success("Job created", { description: "It is open and accepting applications." })
      setTitle("")
      setDescription("")
      setCreating(false)
      onChanged()
      const created = res.data as MinimalJob
      if (created?.id) onJobSelected(created.id)
    } catch (err) {
      toast.error("Could not create the job", {
        description: err instanceof Error ? err.message : "Unexpected error",
      })
    } finally {
      setBusy(null)
    }
  }

  async function setStatus(job: MinimalJob, status: "open" | "closed") {
    setBusy(job.id)
    try {
      const res = await api.setJobStatus(job.id, status)
      if (!res.success) throw new Error(res.error || "Could not update the job")
      const result = res.data as { changed: boolean; message: string }
      toast.success(result.changed ? (status === "closed" ? "Job closed" : "Job reopened") : "No change", {
        description: result.message,
      })
      setConfirmClose(null)
      onChanged()
    } catch (err) {
      toast.error("Could not update the job", {
        description: err instanceof Error ? err.message : "Unexpected error",
      })
    } finally {
      setBusy(null)
    }
  }

  async function saveConfig(patch: Record<string, boolean>) {
    if (!workspace) return
    setBusy("config")
    try {
      const res = await api.updateJobAutomation(workspace.job.id, { ...config, ...patch })
      if (!res.success) throw new Error(res.error || "Could not save the settings")
      toast.success("Settings saved")
      onChanged()
    } catch (err) {
      toast.error("Could not save settings", {
        description: err instanceof Error ? err.message : "Unexpected error",
      })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12.5px] text-muted">
          {jobs.length} role{jobs.length === 1 ? "" : "s"} ·{" "}
          {jobs.filter((j) => j.status === "closed").length} closed
        </p>
        <Button
          variant="action"
          size="sm"
          className="h-8 px-3 text-xs"
          onClick={() => setCreating(true)}
          disabled={busy === "create"}
        >
          <Briefcase size={13} aria-hidden />
          New role
        </Button>
      </div>

      {jobs.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No roles yet"
          description="Create your first role to start screening and shortlisting candidates."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-[0.06em] text-faint">
                <th scope="col" className="px-4 py-2.5 font-medium">Role</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onJobSelected(job.id)}
                      className={`text-left text-[13px] font-medium hover:underline ${
                        workspace?.job.id === job.id ? "text-ink" : "text-muted"
                      }`}
                    >
                      {job.title}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={job.status === "closed" ? "secondary" : "success"}>
                      {job.status === "closed" ? "Closed" : "Open"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {job.status === "closed" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2.5 text-xs"
                        disabled={busy === job.id}
                        onClick={() => setStatus(job, "open")}
                      >
                        <Unlock size={13} aria-hidden />
                        Reopen
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2.5 text-xs"
                        disabled={busy === job.id}
                        onClick={() => setConfirmClose(job)}
                      >
                        <Lock size={13} aria-hidden />
                        Close
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {workspace && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-[13px] font-medium text-ink">
                Automation rules for {workspace.job.title}
              </h3>
              <p className="mt-1 max-w-prose text-[12.5px] leading-relaxed text-muted">
                Every rule is off by default. A candidate is never advanced — and never hired — by
                an AI score alone.
              </p>
            </div>
            <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs" onClick={() => setConfigOpen(true)}>
              Configure
            </Button>
          </div>
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-md">
          <div className="space-y-4 px-6 pt-6">
            <h2 className="text-[16px] font-medium text-ink">New role</h2>
            <Field label="Title" htmlFor="job-title">
              <Input
                id="job-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Senior Backend Engineer"
                autoFocus
              />
            </Field>
            <Field
              label="Job description"
              hint="Used to generate this role's assessment questions and to screen resumes."
              htmlFor="job-description"
            >
              <Textarea
                id="job-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                placeholder="Responsibilities, required skills, experience level…"
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 px-6 pb-6 pt-4">
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button variant="action" size="sm" onClick={create} disabled={busy === "create"}>
              {busy === "create" && <Loader2 size={13} className="animate-spin" aria-hidden />}
              Create role
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmClose !== null} onOpenChange={(o) => !o && setConfirmClose(null)}>
        <DialogContent className="max-w-md">
          <div className="px-6 pt-6">
            <h2 className="text-[16px] font-medium text-ink">Close {confirmClose?.title}?</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              The role stops accepting new applications, assessment invitations and stage changes.
              <strong className="text-ink"> Nothing is deleted</strong> — every candidate, screening
              result, assessment, interview and report stays readable, and you can reopen the role at
              any time.
            </p>
          </div>
          <div className="flex justify-end gap-2 px-6 pb-6 pt-5">
            <Button variant="ghost" size="sm" onClick={() => setConfirmClose(null)}>
              Cancel
            </Button>
            <Button
              variant="action"
              size="sm"
              onClick={() => confirmClose && setStatus(confirmClose, "closed")}
              disabled={busy === confirmClose?.id}
            >
              <Lock size={13} aria-hidden />
              Close role
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-lg">
          <div className="px-6 pt-6">
            <h2 className="text-[16px] font-medium text-ink">Automation rules</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
              These are per-role and off by default. Leave them off to keep every stage change an
              explicit recruiter decision.
            </p>
            <div className="mt-4 space-y-3">
              <Toggle
                label="Screening pass → Shortlisted"
                hint="Moves a candidate who passes the AI screen into the shortlist automatically."
                checked={config.screening_to_assessment === true}
                disabled={busy === "config"}
                onChange={(v) => saveConfig({ screening_to_assessment: v })}
              />
              <Toggle
                label="Assessment pass → Technical round"
                hint="Creates the technical interview automatically for candidates who pass."
                checked={config.assessment_to_technical === true}
                disabled={busy === "config"}
                onChange={(v) => saveConfig({ assessment_to_technical: v })}
              />
              <Toggle
                label="Technical pass → Interview"
                checked={config.technical_to_hr === true}
                disabled={busy === "config"}
                onChange={(v) => saveConfig({ technical_to_hr: v })}
              />
              <Toggle
                label="Interview pass → Final decision"
                checked={config.hr_to_offer === true}
                disabled={busy === "config"}
                onChange={(v) => saveConfig({ hr_to_offer: v })}
              />
              <Toggle
                label="Allow invitations on a closed job"
                hint="Off by default. When off, a closed job refuses every assessment invitation."
                checked={config.allow_invites_when_closed === true}
                disabled={busy === "config"}
                onChange={(v) => saveConfig({ allow_invites_when_closed: v })}
              />
            </div>
          </div>
          <div className="flex justify-end px-6 pb-6 pt-4">
            <Button variant="ghost" size="sm" onClick={() => setConfigOpen(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  disabled?: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-[8px] border border-border p-3">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-3.5 accent-[var(--color-ink)]"
      />
      <span>
        <span className="block text-[12.5px] font-medium text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-[11.5px] text-muted">{hint}</span>}
      </span>
    </label>
  )
}