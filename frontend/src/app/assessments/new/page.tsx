"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useApi } from "@/hooks/use-api"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { ROUTES } from "@/lib/constants"
import type { MinimalJob } from "@/lib/types"
import { inputCls, textareaCls, labelCls } from "@/components/assessments/question-editors"

type JobChoice = "none" | "existing" | "new"

export default function NewAssessmentPage() {
  const api = useApi()
  const router = useRouter()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [skills, setSkills] = useState("")
  const [duration, setDuration] = useState("60")
  const [jobChoice, setJobChoice] = useState<JobChoice>("none")
  const [jobs, setJobs] = useState<MinimalJob[]>([])
  const [jobId, setJobId] = useState("")
  const [newJobTitle, setNewJobTitle] = useState("")
  const [newJobDescription, setNewJobDescription] = useState("")
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    api.listJobs().then((res) => {
      if (res.success && res.data) {
        setJobs(res.data)
        if (res.data.length > 0) setJobId(res.data[0].id)
      }
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCreate = async () => {
    const durationNum = Number(duration)
    if (!Number.isFinite(durationNum) || durationNum <= 0) {
      toast.error("Duration must be a positive number of minutes")
      return
    }
    if (jobChoice === "existing" && !jobId) {
      toast.error("Select an existing job or choose another option")
      return
    }
    if (jobChoice === "new" && !newJobTitle.trim()) {
      toast.error("New job needs a title")
      return
    }
    setCreating(true)
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim(),
        duration_minutes: durationNum,
        skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
      }
      if (jobChoice === "existing") body.job_id = jobId
      if (jobChoice === "new") {
        body.new_job = { title: newJobTitle.trim(), description: newJobDescription.trim() }
      }
      const res = await api.createAssessment(body)
      if (res.success && res.data) {
        toast.success("Draft assessment created")
        router.push(ROUTES.assessmentDetail(res.data.id))
      } else {
        toast.error(res.error || "Failed to create assessment")
      }
    } catch {
      toast.error("Failed to create assessment")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="pt-6 space-y-6 max-w-2xl">
      <PageHeader
        title="New assessment"
        description="Start a draft — you will add questions, settings, and invitations next."
      />
      <div className="space-y-4 rounded-lg border border-border bg-surface p-4 sm:p-5">
        <div>
          <label className={labelCls}>Assessment name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Backend Engineer Screen" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={textareaCls} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Skills (comma-separated)</label>
            <input type="text" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="javascript, sql" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Duration (minutes)</label>
            <input type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Job (optional — select existing or create a minimal one)</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {([["none", "No job"], ["existing", "Existing job"], ["new", "New job"]] as Array<[JobChoice, string]>).map(([v, l]) => (
              <button
                key={v}
                type="button"
                onClick={() => setJobChoice(v)}
                className={`h-8 rounded-lg px-3 text-xs font-medium transition-colors ${
                  jobChoice === v ? "bg-ink text-canvas" : "border border-border text-muted hover:bg-surface-secondary hover:text-ink"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          {jobChoice === "existing" && (
            jobs.length === 0 ? (
              <p className="text-xs text-faint">No jobs yet — choose “New job” to create one.</p>
            ) : (
              <select value={jobId} onChange={(e) => setJobId(e.target.value)} className={inputCls}>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.title}</option>
                ))}
              </select>
            )
          )}
          {jobChoice === "new" && (
            <div className="space-y-2">
              <input type="text" value={newJobTitle} onChange={(e) => setNewJobTitle(e.target.value)} placeholder="Job title" className={inputCls} />
              <input type="text" value={newJobDescription} onChange={(e) => setNewJobDescription(e.target.value)} placeholder="Short description (optional)" className={inputCls} />
              <p className="text-xs text-faint">An Assessment hiring stage is created for the job automatically (reused if one already exists).</p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push(ROUTES.assessments)} disabled={creating}>
            Cancel
          </Button>
          <Button size="sm" className="bg-ink text-canvas hover:bg-ink/90" onClick={handleCreate} disabled={creating}>
            {creating && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
            Create draft
          </Button>
        </div>
      </div>
    </div>
  )
}
