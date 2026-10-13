"use client"

import Link from "next/link"
import { Check, Circle, Loader2, Ban } from "lucide-react"
import { cn } from "@/lib/utils"
import type { JourneyStep } from "@/lib/types"

/**
 * Unified recruitment journey for one candidate on one job.
 *
 * `Screened → Shortlisted → Assessment Invited → Assessment Completed →
 * Report Reviewed → Technical Round → Interview → Final Decision`
 *
 * Each step shows its REAL status and timestamp. Clicking a completed stage
 * opens the record it summarises (assessment, report, interview) rather than an
 * unrelated page, and steps that have not happened are not links at all.
 */
export function CandidateJourney({ steps, className }: { steps: JourneyStep[]; className?: string }) {
  if (steps.length === 0) {
    return <p className="text-[13px] text-muted">No journey recorded for this application yet.</p>
  }

  return (
    <ol className={cn("space-y-0", className)}>
      {steps.map((step, index) => {
        const Icon =
          step.state === "completed"
            ? Check
            : step.state === "current"
              ? Loader2
              : step.state === "blocked"
                ? Ban
                : Circle

        const body = (
          <>
            <span className="relative flex flex-col items-center">
              <span
                data-state={step.state}
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border",
                  step.state === "completed" && "border-success/40 bg-success/10 text-success",
                  step.state === "current" && "border-info/40 bg-info/10 text-info",
                  step.state === "upcoming" && "border-border bg-surface-secondary text-faint",
                  step.state === "blocked" && "border-danger/30 bg-danger/10 text-danger",
                )}
              >
                <Icon
                  size={11}
                  strokeWidth={2.5}
                  aria-hidden
                  className={cn(step.state === "current" && "animate-spin")}
                />
              </span>
              {index < steps.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    "mt-1 h-6 w-px",
                    step.state === "completed" ? "bg-success/30" : "bg-border",
                  )}
                />
              )}
            </span>

            <span className="min-w-0 flex-1 pb-4">
              <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span
                  className={cn(
                    "text-[13px] font-medium",
                    step.state === "upcoming" ? "text-muted" : "text-ink",
                  )}
                >
                  {step.label}
                </span>
                {step.at && (
                  <time dateTime={step.at} className="font-data text-[11px] text-faint">
                    {formatWhen(step.at)}
                  </time>
                )}
                {step.state === "current" && (
                  <span className="text-[11px] text-info">Current stage</span>
                )}
              </span>
              {step.detail && (
                <span className="mt-0.5 block text-[12px] text-muted">{step.detail}</span>
              )}
            </span>
          </>
        )

        return (
          <li key={step.key}>
            {step.href && step.state !== "upcoming" ? (
              <Link
                href={step.href}
                className="flex gap-3 rounded-[8px] px-1 py-0.5 -mx-1 transition-colors duration-120 hover:bg-hover-tone"
              >
                {body}
              </Link>
            ) : (
              <div className="flex gap-3">{body}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

function formatWhen(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}