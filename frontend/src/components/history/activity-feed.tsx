"use client"

import { History, ChevronLeft, ChevronRight } from "lucide-react"
import { ActivityItem } from "./activity-item"
import type { HistoryEntry } from "@/lib/types"
import { Button } from "@/components/ui/button"

export function ActivityFeed({
  entries,
  total,
  page,
  totalPages,
  onPageChange,
  isLoading,
}: {
  entries: HistoryEntry[]
  total: number
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className="bg-surface border border-border rounded-xl divide-y divide-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4">
            <div className="h-9 w-9 rounded-full bg-surface-secondary animate-pulse-soft shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 bg-surface-secondary rounded-full animate-pulse-soft" />
              <div className="h-3 w-1/3 bg-surface-secondary rounded-full animate-pulse-soft" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-16">
        <div className="flex flex-col items-center text-center max-w-sm mx-auto">
          <div className="h-16 w-16 rounded-[10px] bg-surface-secondary flex items-center justify-center mb-5">
            <History className="h-7 w-7 text-faint" strokeWidth={1.5} />
          </div>
          <h3 className="text-base font-medium text-ink mb-1">No activity found</h3>
          <p className="text-sm text-muted leading-relaxed">
            Try adjusting your filters or search. Activity will appear as you use RecruitIQ.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="bg-surface border border-border rounded-xl divide-y divide-border">
        {entries.map((entry, i) => (
          <ActivityItem key={entry.id} entry={entry} index={i} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-muted">
            {total} result{total !== 1 ? "s" : ""} · Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
            >
              <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
