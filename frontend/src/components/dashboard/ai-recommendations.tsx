"use client"

import Link from "next/link"
import { Sparkles, ChevronRight } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { PanelHeader } from "@/components/ui/panel-header"
import { getInitials, ROUTES } from "@/lib/constants"
import type { AiRecommendation } from "@/lib/types"

export function AiRecommendations({ items }: { items: AiRecommendation[] }) {
  if (!items || items.length === 0) return null

  return (
    <section className="min-w-0">
      <PanelHeader
        title="AI recommendations"
        description="Highest-scoring candidates across your pipeline"
        className="mb-2.5"
        action={
          <Link
            href={ROUTES.candidates}
            className="group inline-flex items-center gap-1 text-[12px] font-medium text-muted transition-colors duration-120 hover:text-ink"
          >
            View all
            <ChevronRight
              className="size-3.5 transition-transform group-hover:translate-x-0.5"
              strokeWidth={1.5}
              aria-hidden
            />
          </Link>
        }
      />

      <ul className="grid gap-2.5 sm:grid-cols-2">
        {items.slice(0, 4).map((item) => {
          // `skills` is declared required but older API rows omit it — never
          // let a missing optional field take the whole panel down.
          const skills = Array.isArray(item.skills) ? item.skills : []
          return (
            <li key={item.id}>
              <Link
                href={`${ROUTES.candidates}/${item.id}`}
                className="group flex min-w-0 flex-col rounded-xl border border-border bg-surface p-3.5 transition-all duration-150 hover:border-border-hover hover:shadow-md"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar className="size-9 shrink-0">
                    <AvatarFallback className="font-data text-[11px] font-medium">
                      {getInitials(item.full_name ?? undefined)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink">
                      {item.full_name || "Unknown candidate"}
                    </p>
                    <p className="truncate text-[11.5px] text-muted">
                      {[item.current_title, item.current_company].filter(Boolean).join(" · ") ||
                        "No title on record"}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 rounded-md border border-accent-border bg-accent-soft px-1.5 py-0.5">
                    <Sparkles className="size-2.5 text-accent" strokeWidth={2} aria-hidden />
                    <span className="font-data text-[11px] font-medium text-accent">
                      {Math.round((item.match_score ?? 0) * 100)}%
                    </span>
                  </span>
                </div>

                {skills.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1">
                    {skills.slice(0, 3).map((skill, j) => (
                      <span
                        key={`${skill}-${j}`}
                        className="truncate rounded border border-border bg-canvas px-1.5 py-px text-[10.5px] text-muted"
                      >
                        {skill}
                      </span>
                    ))}
                    {skills.length > 3 && (
                      <span className="text-[10.5px] text-faint">+{skills.length - 3}</span>
                    )}
                  </div>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
