"use client"

import { useMemo, useState } from "react"
import { ChevronDown, Briefcase, Check } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { MinimalJob } from "@/lib/types"

/**
 * Job switcher for the recruitment workspace.
 *
 * The whole workspace is scoped to one job at a time so the recruiter never has
 * to guess which pipeline a candidate belongs to. Open/closed state is always
 * visible here — a closed job still opens for historical review, it just cannot
 * start new recruitment activity.
 */
export function JobSwitcher({
  jobs,
  selectedJobId,
  onSelect,
  disabled = false,
}: {
  jobs: MinimalJob[]
  selectedJobId: string | null
  onSelect: (jobId: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)

  const selected = useMemo(
    () => jobs.find((j) => j.id === selectedJobId) ?? null,
    [jobs, selectedJobId],
  )

  const grouped = useMemo(
    () => ({
      open: jobs.filter((j) => j.status !== "closed"),
      closed: jobs.filter((j) => j.status === "closed"),
    }),
    [jobs],
  )

  if (jobs.length === 0) return null

  const renderOption = (job: MinimalJob) => (
    <button
      key={job.id}
      type="button"
      disabled={disabled}
      onClick={() => {
        onSelect(job.id)
        setOpen(false)
      }}
      className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors duration-120 hover:bg-hover-tone disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Briefcase size={14} strokeWidth={1.75} className="mt-0.5 shrink-0 text-faint" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] text-ink">{job.title}</span>
        <span className="mt-0.5 block text-[11px] text-faint">
          {job.status === "closed" ? "Closed · history only" : "Accepting applications"}
        </span>
      </span>
      {job.id === selectedJobId && (
        <Check size={14} strokeWidth={2} className="mt-0.5 shrink-0 text-ink" aria-hidden />
      )}
    </button>
  )

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-9 w-full max-w-sm items-center gap-2 rounded-[8px] border border-border bg-surface px-3 text-left transition-colors duration-120 hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Briefcase size={14} strokeWidth={1.75} className="shrink-0 text-faint" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
          {selected ? selected.title : "Select a job"}
        </span>
        {selected && (
          <Badge variant={selected.status === "closed" ? "secondary" : "success"} className="shrink-0">
            {selected.status === "closed" ? "Closed" : "Open"}
          </Badge>
        )}
        <ChevronDown
          size={14}
          strokeWidth={1.75}
          className={`shrink-0 text-faint transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="listbox"
            aria-label="Select a job"
            className="absolute left-0 top-11 z-30 max-h-80 w-full min-w-[18rem] overflow-y-auto rounded-[10px] border border-border bg-surface shadow-lg"
          >
            {grouped.open.length > 0 && (
              <>
                <p className="px-3 pb-1 pt-2.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-faint">
                  Open
                </p>
                {grouped.open.map(renderOption)}
              </>
            )}
            {grouped.closed.length > 0 && (
              <>
                <p className="border-t border-border px-3 pb-1 pt-2.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-faint">
                  Closed · history only
                </p>
                {grouped.closed.map(renderOption)}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}