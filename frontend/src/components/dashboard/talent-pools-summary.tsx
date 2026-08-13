"use client"

import Link from "next/link"
import { Users, TrendingUp, ChevronRight, Layers } from "lucide-react"
import { PanelHeader } from "@/components/ui/panel-header"
import { EmptyState } from "@/components/ui/empty-state"
import type { TopTalentPool } from "@/lib/types"

export function TalentPoolsSummary({ items }: { items: TopTalentPool[] }) {
  return (
    <section>
      <PanelHeader
        title="Talent Pools"
        description="Your curated candidate collections"
        className="mb-3"
        action={
          items.length > 0 ? (
            <Link
              href="/pools"
              className="inline-flex items-center gap-1 text-[12px] font-medium text-muted transition-colors duration-120 hover:text-ink"
            >
              View all
              <ChevronRight className="size-3.5" strokeWidth={1.5} />
            </Link>
          ) : undefined
        }
      />
      {items.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState
            icon={Layers}
            title="No talent pools yet"
            description="Group candidates into pools to track them over time."
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {items.map((pool) => (
            <Link
              key={pool.id}
              href={`/pools/${pool.id}`}
              className="group rounded-lg border border-border bg-surface p-4 transition-all duration-120 hover:border-border-hover"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-secondary text-muted">
                  <Users className="size-4" strokeWidth={1.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-ink">{pool.name}</p>
                  <p className="text-[11px] text-muted">
                    <span className="font-data">{pool.candidate_count}</span> candidate
                    {pool.candidate_count !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <TrendingUp className="size-3.5 text-success" strokeWidth={1.5} />
                <span className="font-data text-[13px] font-medium text-ink">
                  {pool.average_score}%
                </span>
              </div>
              <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-track">
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