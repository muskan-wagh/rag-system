"use client"

import Link from "next/link"
import { Users, TrendingUp, ChevronRight, Layers } from "lucide-react"
import { PanelHeader } from "@/components/ui/panel-header"
import { EmptyState } from "@/components/ui/empty-state"
import type { TopTalentPool } from "@/lib/types"

export function TalentPoolsSummary({ items }: { items: TopTalentPool[] }) {
  return (
    <section className="min-w-0">
      <PanelHeader
        title="Talent Pools"
        description="Your curated candidate collections"
        className="mb-2"
        action={
          items.length > 0 ? (
            <Link
              href="/pools"
              className="group inline-flex items-center gap-1 text-[12px] font-medium text-muted transition-colors duration-120 hover:text-ink"
            >
              View all
              <ChevronRight className="size-3.5 transition-transform duration-120 group-hover:translate-x-px" strokeWidth={1.5} />
            </Link>
          ) : undefined
        }
      />
      {items.length === 0 ? (
        <div className="rounded-md border border-border bg-surface">
          <EmptyState
            icon={Layers}
            title="No talent pools yet"
            description="Group candidates into pools to track them over time."
          />
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 sm:gap-2.5 xl:grid-cols-4">
          {items.map((pool) => (
            <Link
              key={pool.id}
              href={`/pools/${pool.id}`}
              className="group min-w-0 rounded-md border border-border bg-surface p-3 transition-all duration-120 hover:border-border-hover hover:shadow-sm active:scale-[0.99]"
            >
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-secondary text-info transition-colors duration-120">
                  <Users className="size-3.5" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-ink">{pool.name}</p>
                  <p className="text-[11px] text-muted">
                    <span className="font-data">{pool.candidate_count}</span> candidate
                    {pool.candidate_count !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <div className="mt-2.5 flex items-center gap-1.5">
                <TrendingUp className="size-3 text-success" strokeWidth={1.5} />
                <span className="font-data text-[12px] font-medium text-ink">
                  {pool.average_score}%
                </span>
              </div>
              <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-track">
                <div
                  className="h-full rounded-full bg-info transition-all duration-500"
                  style={{ width: `${pool.average_score}%` }}
                />
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}