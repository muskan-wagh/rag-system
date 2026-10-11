"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"

export interface StageNode {
  label: string
  count: number
  href: string
}

const BAR: Record<string, string> = {
  Applied: "bg-warning",
  Screening: "bg-info",
  Assessment: "bg-accent",
  Technical: "bg-info",
  HR: "bg-warning",
  Offer: "bg-success",
  Hired: "bg-success",
  Rejected: "bg-danger",
}

/**
 * The pipeline as one continuous rail. Each stage is a node whose diameter
 * scales with the share of the widest stage, so the row communicates both
 * distribution and drop-off at a glance, and every node deep-links to the
 * candidates sitting in that stage.
 */
export function PipelineFlow({ stages }: { stages: StageNode[] }) {
  const max = Math.max(1, ...stages.map((s) => s.count))

  return (
    <div className="relative">
      {/* Rail sits behind the nodes and stops short of the outer edges. */}
      <div
        className="absolute left-[6%] right-[6%] top-[15px] hidden h-px bg-border sm:block"
        aria-hidden
      />

      <ol className="relative grid grid-cols-4 gap-y-6 sm:grid-cols-8">
        {stages.map((stage) => {
          const ratio = stage.count / max
          const empty = stage.count === 0
          // 10px node at zero, scaling to 20px for the largest stage.
          const size = empty ? 10 : 10 + ratio * 10

          return (
            <li key={stage.label} className="min-w-0">
              <Link
                href={stage.href}
                className="group flex flex-col items-center gap-2 text-center"
                title={`${stage.label}: ${stage.count} candidate${stage.count === 1 ? "" : "s"}`}
              >
                {/* Node: the ring knocks a hole in the rail so it reads as
                    threaded rather than drawn over. */}
                <span className="relative flex h-[30px] w-full items-center justify-center bg-surface">
                  <span
                    className={cn(
                      "rounded-full ring-4 ring-surface transition-transform duration-200 ease-out group-hover:scale-125",
                      empty ? "bg-border" : BAR[stage.label] ?? "bg-ink",
                    )}
                    style={{ width: size, height: size }}
                  />
                </span>

                <span className="-mt-1 flex flex-col items-center gap-1">
                  <span
                    className={cn(
                      "font-data text-[18px] font-medium leading-none tracking-tight",
                      empty ? "text-faint" : "text-ink",
                    )}
                  >
                    {stage.count.toLocaleString()}
                  </span>
                  <span className="max-w-full truncate text-[11px] leading-none text-muted transition-colors group-hover:text-ink">
                    {stage.label}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
