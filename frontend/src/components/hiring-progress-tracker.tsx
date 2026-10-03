"use client"

import { cn } from "@/lib/utils"
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
  if (stage === "Technical Interview") return "Technical";
  if (stage === "Managerial/HR") return "HR";
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
      <div className="text-sm text-muted-foreground" data-testid="progress-empty">
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
            {i > 0 && <span aria-hidden className="text-muted-foreground">→</span>}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
                done && "border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                current && "border-blue-600/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
                !done && !current && "border-border text-muted-foreground",
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
              {variant === "candidate" && s.stage === "Managerial/HR" ? "HR Interview" : shortLabel(s.stage)}
              {showScore ? <span className="tabular-nums opacity-80">({Math.round(s.score as number)}%)</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
