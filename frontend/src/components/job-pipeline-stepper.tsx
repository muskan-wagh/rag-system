"use client"

import Link from "next/link"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export interface PipelineStep {
  key: string
  label: string
  shortLabel?: string
  count: number
  href: string
  state: "completed" | "current" | "upcoming"
}

/**
 * Job pipeline stepper: Job → stages → candidates → action.
 * Every stage is clickable and deep-links to the real candidates in that
 * stage for the job. Counts come from GET /jobs/:jobId/hiring-summary —
 * never hardcoded. State (completed/current/upcoming) is derived from
 * whether stages before/after have candidates.
 */
export function JobPipelineStepper({
  steps,
  className,
}: {
  steps: PipelineStep[]
  className?: string
}) {
  if (steps.length === 0) return null
  return (
    <ol
      aria-label="Hiring pipeline"
      className={cn("flex flex-wrap items-stretch gap-1.5", className)}
      data-testid="job-pipeline-stepper"
    >
      {steps.map((step, i) => (
        <li key={step.key} className="flex min-w-0 items-stretch">
          {i > 0 ? (
            <span aria-hidden className="mx-0.5 self-center text-faint">
              →
            </span>
          ) : null}
          <Link
            href={step.href}
            title={`${step.label}: ${step.count} candidates`}
            className={cn(
              "group flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors duration-120",
              step.state === "completed" &&
                "border-success/40 bg-success/10 hover:bg-success/15",
              step.state === "current" &&
                "border-info/40 bg-info/10 hover:bg-info/15",
              step.state === "upcoming" &&
                "border-border bg-surface hover:bg-surface-secondary"
            )}
          >
            {step.state === "completed" ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-success" aria-label="has candidates" />
            ) : null}
            <span className="flex flex-col leading-tight">
              <span
                className={cn(
                  "text-xs font-medium",
                  step.state === "upcoming" ? "text-muted" : "text-ink"
                )}
              >
                {step.shortLabel || step.label}
              </span>
              <span className="font-data text-sm font-semibold tabular-nums text-ink">
                {step.count.toLocaleString()}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  )
}

/** Derive stepper states: the furthest stage holding candidates is current, earlier populated stages are completed. */
export function withStepperStates(
  steps: Array<Omit<PipelineStep, "state">>
): PipelineStep[] {
  const lastActive = steps.reduce(
    (acc, s, i) => (s.count > 0 ? i : acc),
    -1
  )
  return steps.map((s, i) => ({
    ...s,
    state:
      s.count <= 0
        ? ("upcoming" as const)
        : i === lastActive
          ? ("current" as const)
          : ("completed" as const),
  }))
}
