"use client"

import { useCallback, useEffect, useState, startTransition } from "react"
import Link from "next/link"
import { Briefcase, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useApi } from "@/hooks/use-api"
import { PageHeader } from "@/components/ui/page-header"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { ROUTES } from "@/lib/constants"
import type { MinimalJob } from "@/lib/types"

export default function JobsPage() {
  const api = useApi()
  const [jobs, setJobs] = useState<MinimalJob[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    startTransition(() => setLoading(true))
    try {
      const res = await api.listJobs()
      if (res.success && res.data) startTransition(() => setJobs(res.data ?? []))
    } catch {
      toast.error("Failed to load jobs")
    } finally {
      startTransition(() => setLoading(false))
    }
  }, [api])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="pt-6 space-y-6">
      <PageHeader
        title="Jobs"
        description="Run RAG screening per job, then invite qualified candidates to assessments (invite stays recruiter-controlled)."
      />

      <div className="bg-surface rounded-lg border border-border overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No jobs yet"
            description="Create a job from the assessment builder — screening runs per job."
          />
        ) : (
          <ul className="divide-y divide-border">
            {jobs.map((job) => (
              <li key={job.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{job.title}</p>
                  {job.description ? (
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {job.description.slice(0, 160)}
                    </p>
                  ) : null}
                </div>
                <Link
                  href={ROUTES.jobScreening(job.id)}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-secondary"
                >
                  Open screening
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading jobs…
        </p>
      ) : null}
    </div>
  )
}
