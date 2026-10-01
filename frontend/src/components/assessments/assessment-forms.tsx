"use client"

import { useEffect, useState } from "react"
import { Loader2, Save } from "lucide-react"
import { toast } from "sonner"
import { useApi } from "@/hooks/use-api"
import { Button } from "@/components/ui/button"
import type { AssessmentDetail, MinimalJob } from "@/lib/types"
import { inputCls, textareaCls, labelCls } from "./question-editors"

function toLocalInput(value: string | null): string {
  if (!value) return ""
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromLocalInput(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function AssessmentDetailsForm({
  assessment,
  onSaved,
}: {
  assessment: AssessmentDetail
  onSaved: (next: AssessmentDetail) => void
}) {
  const api = useApi()
  const locked = assessment.status === "published"
  const [name, setName] = useState(assessment.name || "")
  const [description, setDescription] = useState(assessment.description || "")
  const [instructions, setInstructions] = useState(assessment.instructions || "")
  const [skills, setSkills] = useState((assessment.skills || []).join(", "))
  const [jobId, setJobId] = useState(assessment.job_id || "")
  const [jobs, setJobs] = useState<MinimalJob[]>([])
  const [newJobTitle, setNewJobTitle] = useState("")
  const [showNewJob, setShowNewJob] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.listJobs().then((res) => {
      if (res.success && res.data) setJobs(res.data)
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSave = async () => {
    let nextJobId: string | null | undefined = undefined
    if (showNewJob) {
      if (!newJobTitle.trim()) {
        toast.error("New job needs a title")
        return
      }
      setSaving(true)
      try {
        const res = await api.createJob({ title: newJobTitle.trim() })
        if (!res.success || !res.data) {
          toast.error(res.error || "Failed to create job")
          setSaving(false)
          return
        }
        nextJobId = res.data.id
        setJobs((j) => [res.data as MinimalJob, ...j])
      } catch {
        toast.error("Failed to create job")
        setSaving(false)
        return
      }
    } else if (jobId !== (assessment.job_id || "")) {
      nextJobId = jobId ? jobId : null
    }

    const body: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim(),
      instructions: instructions.trim(),
      skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
    }
    if (nextJobId !== undefined) body.job_id = nextJobId

    try {
      const res = await api.saveAssessmentDraft(assessment.id, body)
      if (res.success && res.data) {
        toast.success("Draft saved")
        setShowNewJob(false)
        setNewJobTitle("")
        const full = await api.getAssessment(assessment.id)
        if (full.success && full.data) onSaved(full.data)
        else onSaved({ ...assessment, ...(res.data as Partial<AssessmentDetail>) } as AssessmentDetail)
      } else {
        toast.error(res.error || "Failed to save draft")
      }
    } catch {
      toast.error("Failed to save draft")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-surface p-4 sm:p-5">
      {locked && (
        <p className="rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
          Published assessments are locked. Unpublish to draft before editing.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls}>Assessment name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} disabled={locked} placeholder="e.g. Backend Engineer Screen" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={locked} rows={3} className={textareaCls} />
        </div>
        <div>
          <label className={labelCls}>Candidate instructions</label>
          <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} disabled={locked} rows={3} className={textareaCls} />
        </div>
        <div>
          <label className={labelCls}>Skills being tested (comma-separated)</label>
          <input type="text" value={skills} onChange={(e) => setSkills(e.target.value)} disabled={locked} placeholder="e.g. javascript, sql, algorithms" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Linked job</label>
          {!showNewJob ? (
            <div className="flex gap-2">
              <select value={jobId} onChange={(e) => setJobId(e.target.value)} disabled={locked} className={inputCls}>
                <option value="">No job (standalone)</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.title}</option>
                ))}
              </select>
              {!locked && (
                <Button variant="outline" size="sm" className="shrink-0" onClick={() => setShowNewJob(true)}>
                  New job
                </Button>
              )}
            </div>
          ) : (
            <div className="flex gap-2">
              <input type="text" value={newJobTitle} onChange={(e) => setNewJobTitle(e.target.value)} disabled={locked} placeholder="New job title" className={inputCls} />
              <Button variant="ghost" size="sm" className="shrink-0" onClick={() => { setShowNewJob(false); setNewJobTitle("") }}>
                Cancel
              </Button>
            </div>
          )}
          {assessment.job && (
            <p className="mt-1 text-xs text-faint">Currently linked: {assessment.job.title}</p>
          )}
        </div>
      </div>
      {!locked && (
        <div className="flex justify-end">
          <Button size="sm" className="bg-ink text-canvas hover:bg-ink/90" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
            Save Draft
          </Button>
        </div>
      )}
    </div>
  )
}

export function AssessmentSettingsForm({
  assessment,
  onSaved,
}: {
  assessment: AssessmentDetail
  onSaved: (next: AssessmentDetail) => void
}) {
  const api = useApi()
  const locked = assessment.status === "published"
  const [duration, setDuration] = useState(String(assessment.duration_minutes ?? 60))
  const [passing, setPassing] = useState(String(assessment.passing_score ?? 0))
  const [from, setFrom] = useState(toLocalInput(assessment.available_from))
  const [until, setUntil] = useState(toLocalInput(assessment.available_until))
  const [randomize, setRandomize] = useState(Boolean(assessment.settings?.randomize_questions))
  const [revisit, setRevisit] = useState(assessment.settings?.allow_revisit ?? true)
  const [autoSubmit, setAutoSubmit] = useState(assessment.settings?.auto_submit ?? true)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    const durationNum = Number(duration)
    const passingNum = Number(passing)
    if (!Number.isFinite(durationNum) || durationNum <= 0) {
      toast.error("Duration must be a positive number of minutes")
      return
    }
    if (!Number.isFinite(passingNum) || passingNum < 0) {
      toast.error("Passing score must be >= 0")
      return
    }
    const fromIso = fromLocalInput(from)
    const untilIso = fromLocalInput(until)
    if (fromIso && untilIso && new Date(fromIso).getTime() >= new Date(untilIso).getTime()) {
      toast.error("Available-from must be earlier than available-until")
      return
    }
    setSaving(true)
    try {
      const res = await api.saveAssessmentDraft(assessment.id, {
        duration_minutes: durationNum,
        passing_score: passingNum,
        available_from: fromIso,
        available_until: untilIso,
        settings: { randomize_questions: randomize, allow_revisit: revisit, auto_submit: autoSubmit },
      })
      if (res.success && res.data) {
        toast.success("Draft saved")
        const full = await api.getAssessment(assessment.id)
        if (full.success && full.data) onSaved(full.data)
      } else {
        toast.error(res.error || "Failed to save draft")
      }
    } catch {
      toast.error("Failed to save draft")
    } finally {
      setSaving(false)
    }
  }

  const toggleCls = "size-4 accent-primary"

  return (
    <div className="space-y-4 rounded-lg border border-border bg-surface p-4 sm:p-5">
      {locked && (
        <p className="rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
          Published assessments are locked. Unpublish to draft before editing.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Duration (minutes)</label>
          <input type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} disabled={locked} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Passing score (must be ≤ total marks at publish)</label>
          <input type="number" min={0} step="any" value={passing} onChange={(e) => setPassing(e.target.value)} disabled={locked} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Available from (optional)</label>
          <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} disabled={locked} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Available until (optional)</label>
          <input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} disabled={locked} className={inputCls} />
        </div>
      </div>
      <div className="space-y-2.5 rounded-md border border-border p-3">
        <p className="text-xs font-medium text-ink">Candidate behavior (stored as configuration only)</p>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={randomize} onChange={(e) => setRandomize(e.target.checked)} disabled={locked} className={toggleCls} />
          Randomize question order
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={revisit} onChange={(e) => setRevisit(e.target.checked)} disabled={locked} className={toggleCls} />
          Allow candidates to revisit questions
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={autoSubmit} onChange={(e) => setAutoSubmit(e.target.checked)} disabled={locked} className={toggleCls} />
          Auto-submit when time expires
        </label>
        <p className="text-xs text-faint">These flags are saved with the assessment but not enforced yet — the candidate experience is a later phase.</p>
      </div>
      {!locked && (
        <div className="flex justify-end">
          <Button size="sm" className="bg-ink text-canvas hover:bg-ink/90" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
            Save Draft
          </Button>
        </div>
      )}
    </div>
  )
}
