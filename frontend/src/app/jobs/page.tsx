"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { Briefcase, Loader2, Plus, Sparkles, ArrowRight, X } from "lucide-react"
import { toast } from "sonner"
import { useApi } from "@/hooks/use-api"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input, Field } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ROUTES } from "@/lib/constants"
import type { MinimalJob } from "@/lib/types"

export default function JobsPage() {
  const api = useApi()
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [creating, setCreating] = useState(false)
  const [titleError, setTitleError] = useState("")

  // SWR handles caching, revalidation and the loading flag, matching every
  // other list screen in the app.
  const { data: jobsRes, isLoading, error: loadErrorRaw, mutate } = useSWR(
    ["jobs"],
    () => api.listJobs(),
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  )

  const jobs: MinimalJob[] = jobsRes?.data ?? []
  const loadError = loadErrorRaw
    ? "Could not reach the server. Check your connection and try again."
    : jobsRes && !jobsRes.success
      ? jobsRes.error || "Could not load jobs"
      : ""

  const handleCreate = async () => {
    const trimmed = title.trim()
    if (!trimmed) {
      setTitleError("Give the role a title so you can find it later.")
      return
    }
    setCreating(true)
    setTitleError("")
    try {
      const res = await api.createJob({ title: trimmed, description: description.trim() || undefined })
      if (!res.success || !res.data) {
        toast.error(res.error || "Could not create the job")
        return
      }
      toast.success(`${trimmed} created`)
      setCreateOpen(false)
      setTitle("")
      setDescription("")
      router.push(ROUTES.jobDetail(res.data.id))
    } catch {
      toast.error("Could not create the job")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Jobs"
        description="Each job owns its screening run, assessment and candidate pipeline."
        actions={
          <Button variant="action" onClick={() => setCreateOpen(true)}>
            <Plus strokeWidth={2.25} />
            New job
          </Button>
        }
      />

      {loadError && (
        <div className="rounded-xl border border-danger/25 bg-danger/5 p-4">
          <p className="text-[13px] font-medium text-danger">{loadError}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => mutate()}>
            Try again
          </Button>
        </div>
      )}

      {!loadError && (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
          {isLoading ? (
            <ul className="divide-y divide-border">
              {Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className="flex items-center gap-3 p-4">
                  <Skeleton className="size-9 shrink-0 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-48" />
                    <Skeleton className="h-3 w-full max-w-md" />
                  </div>
                </li>
              ))}
            </ul>
          ) : jobs.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="No jobs yet"
              description="Create a role to run semantic screening, generate an assessment and move candidates through the pipeline."
              action={
                <Button variant="action" size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus strokeWidth={2.25} />
                  Create your first job
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {jobs.map((job) => (
                <li key={job.id}>
                  <div className="group flex flex-wrap items-center gap-3 p-4 transition-colors duration-120 hover:bg-hover-tone">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-canvas text-muted transition-colors group-hover:border-accent-border group-hover:bg-accent-soft group-hover:text-accent">
                      <Briefcase className="size-4" strokeWidth={1.75} aria-hidden />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium text-ink">{job.title}</p>
                      {job.description ? (
                        <p className="mt-0.5 line-clamp-1 text-[12px] text-muted">
                          {job.description.slice(0, 180)}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-[12px] text-faint">
                          No description — add one to improve screening accuracy
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        render={<Link href={ROUTES.jobScreening(job.id)} />}
                      >
                        <Sparkles strokeWidth={1.75} />
                        Screening
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        render={<Link href={ROUTES.jobDetail(job.id)} />}
                      >
                        Open workspace
                        <ArrowRight strokeWidth={2} />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <div className="px-6 pb-4 pt-6">
            <h2 className="text-[16px] font-medium tracking-tight text-ink">Create a job</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
              The description becomes the basis for semantic screening, so the more
              specific you are about skills and experience, the better the ranking.
            </p>
          </div>

          <div className="space-y-4 px-6 pb-6">
            <Field label="Job title" required error={titleError} htmlFor="job-title">
              <Input
                id="job-title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  if (titleError) setTitleError("")
                }}
                placeholder="Senior Platform Engineer"
                aria-invalid={Boolean(titleError)}
                autoFocus
              />
            </Field>

            <Field
              label="Description"
              hint="Optional, but it is what candidates are screened against."
              htmlFor="job-description"
            >
              <Textarea
                id="job-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Paste the full job description…"
                className="min-h-[140px]"
              />
            </Field>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
              >
                <X strokeWidth={1.75} />
                Cancel
              </Button>
              <Button variant="action" onClick={handleCreate} disabled={creating}>
                {creating ? <Loader2 className="animate-spin" /> : <Plus strokeWidth={2.25} />}
                {creating ? "Creating…" : "Create job"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
