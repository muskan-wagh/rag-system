"use client"

import Link from "next/link"
import { Sparkles, ChevronRight } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { PanelHeader } from "@/components/ui/panel-header"
import { getInitials, ROUTES } from "@/lib/constants"
import type { AiRecommendation } from "@/lib/types"

export function AiRecommendations({ items }: { items: AiRecommendation[] }) {
  if (items.length === 0) return null
  return (
    <section className="min-w-0">
      <PanelHeader
        title="AI Recommendations"
        description="Top candidates from your pipeline"
        className="mb-2"
        action={
          <Link
            href={ROUTES.candidates}
            className="group inline-flex items-center gap-1 text-[12px] font-medium text-muted transition-colors duration-120 hover:text-ink"
          >
            View all
            <ChevronRight className="size-3.5 transition-transform duration-120 group-hover:translate-x-px" strokeWidth={1.5} />
          </Link>
        }
      />
      <div className="grid gap-2 sm:grid-cols-2 sm:gap-2.5">
        {items.slice(0, 4).map((item) => (
          <Link
            key={item.id}
            href={`${ROUTES.candidates}/${item.id}`}
            className="group min-w-0 rounded-md border border-border bg-surface p-3 transition-all duration-120 hover:border-border-hover hover:shadow-sm active:scale-[0.99]"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar className="size-8 shrink-0">
                <AvatarFallback className="text-[11px] font-medium">
                  {getInitials(item.full_name ?? undefined)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium text-ink">
                  {item.full_name || "Unknown"}
                </p>
                <p className="truncate text-[11px] text-muted">{item.current_title || ""}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1 rounded-md bg-soft px-1.5 py-0.5">
                <Sparkles className="size-3 text-info" strokeWidth={1.5} />
                <span className="font-data text-[11px] font-medium text-ink">
                  {Math.round((item.match_score ?? 0) * 100)}%
                </span>
              </div>
            </div>
            {item.skills.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {item.skills.slice(0, 3).map((skill, j) => (
                  <span
                    key={j}
                    className="truncate rounded bg-surface-secondary px-1.5 py-px text-[10.5px] text-muted"
                  >
                    {skill}
                  </span>
                ))}
                {item.skills.length > 3 && (
                  <span className="text-[10.5px] text-faint">+{item.skills.length - 3}</span>
                )}
              </div>
            )}
          </Link>
        ))}
      </div>
    </section>
  )
}