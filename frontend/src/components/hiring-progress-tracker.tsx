"use client"

import { cn } from "@/lib/utils"
import { normalizeStage } from "@/lib/pipeline"
import { Check, Circle, Loader2 } from "lucide-react"

/**
 * Unified hiring progress tracker (correction #11).
 * Driven ENTIRELY by backend state — no hardcoded booleans.
 * variant=recruiter shows scores; variant=candidate shows safe labels only.
 */

export interface ProgressStage {
  stage: string;
  state: "completed" | "current" | "upcoming";
  score?: number | null;
  status?: string | null;
}

function shortLabel(stage: string): string {
  // Legacy values are normalized first, so a pre-migration row renders with the
  // current label instead of raw text.
  const canonical = normalizeStage(stage) ?? stage
  if (canonical === "Technical Round") return "Technical"
  if (canonical === "Interview") return "HR"
  if (canonical === "Final Decision") return "Decision"
  return stage;
}

export function HiringProgressTracker({
  stages,
  variant = "recruiter",
  className,
}: {
  stages: ProgressStage[];
  variant?: "recruiter" | "candidate";
  className?: string;
}) {
  if (!stages || stages.length === 0) {
    return (
      <div className="text-sm text-muted" data-testid="progress-empty">
        No hiring stages configured.
      </div>
    );
  }
  return (
    <ol
      aria-label="Hiring progress"
      className={cn("flex flex-wrap items-center gap-x-2 gap-y-3", className)}
      data-testid="hiring-progress-tracker"
    >
      {stages.map((s, i) => {
        const done = s.state === "completed";
        const current = s.state === "current";
        const showScore = variant === "recruiter" && typeof s.score === "number";
        return (
          <li key={`${s.stage}-${i}`} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden className="text-muted">→</span>}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
                done && "border-success/40 bg-success/10 text-success dark:text-success",
                current && "border-info/40 bg-info/10 text-info dark:text-info",
                !done && !current && "border-border text-muted",
              )}
              title={s.status || s.stage}
            >
              {done ? (
                <Check className="h-3.5 w-3.5" aria-label="completed" />
              ) : current ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-label="current" />
              ) : (
                <Circle className="h-3.5 w-3.5" aria-label="upcoming" />
              )}
              {variant === "candidate" && normalizeStage(s.stage) === "Interview" ? "HR Interview" : shortLabel(s.stage)}
              {showScore ? <span className="tabular-nums opacity-80">({Math.round(s.score as number)}%)</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
