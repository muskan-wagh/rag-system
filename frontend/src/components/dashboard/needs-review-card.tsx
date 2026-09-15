"use client"

import Link from "next/link"
import { Clock, ChevronRight, Inbox } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { PanelHeader } from "@/components/ui/panel-header"
import { EmptyState } from "@/components/ui/empty-state"
import { getInitials, ROUTES } from "@/lib/constants"
import type { NeedsReviewItem } from "@/lib/types"

export function NeedsReviewCard({ items }: { items: NeedsReviewItem[] }) {
  return (
    <section className="min-w-0">
      <PanelHeader
        title="Needs Review"
        description="Candidates waiting >48h"
        className="mb-2"
        action={
          items.length > 0 ? (
            <Link
              href={`${ROUTES.candidates}?status=applied`}
              className="group inline-flex items-center gap-1 text-[12px] font-medium text-muted transition-colors duration-120 hover:text-ink"
            >
              View all
              <ChevronRight className="size-3.5 transition-transform duration-120 group-hover:translate-x-px" strokeWidth={1.5} />
            </Link>
          ) : undefined
        }
      />
      <div className="overflow-hidden rounded-md border border-border bg-surface">
        {items.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="All caught up"
            description="No candidates require review right now."
          />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`${ROUTES.candidates}/${item.id}`}
                  className="group flex min-w-0 items-center gap-2.5 px-3 py-2.5 transition-colors duration-120 hover:bg-hover-tone"
                >
                  <Avatar className="size-7 shrink-0">
                    <AvatarFallback className="text-[10px] font-medium">
                      {getInitials(item.full_name ?? undefined)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-ink">
                      {item.full_name || "Unknown"}
                    </p>
                    <p className="truncate text-[11px] text-muted">
                      {item.current_title || "No title"}
                      {item.current_title && item.current_company ? " · " : ""}
                      {item.current_company || ""}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 font-data text-[11px] text-faint">
                    <Clock className="size-3 text-warning" strokeWidth={1.75} />
                    {item.days_since_applied}d
                  </span>
                  <ChevronRight className="size-3.5 shrink-0 text-faint transition-all duration-120 group-hover:translate-x-px group-hover:text-muted" strokeWidth={1.5} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}