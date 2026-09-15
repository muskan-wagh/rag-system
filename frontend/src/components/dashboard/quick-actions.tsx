"use client"

import { Sparkles, Users, Calendar, Briefcase, ArrowUpRight, ArrowRight, Zap } from "lucide-react"
import type { QuickAction } from "@/lib/types"

function getActionIcon(icon: string) {
  switch (icon) {
    case "users":
      return <Users className="size-3.5" strokeWidth={1.5} />
    case "calendar":
      return <Calendar className="size-3.5" strokeWidth={1.5} />
    case "briefcase":
      return <Briefcase className="size-3.5" strokeWidth={1.5} />
    case "zap":
      return <Zap className="size-3.5" strokeWidth={1.5} />
    default:
      return <Sparkles className="size-3.5" strokeWidth={1.5} />
  }
}

export function QuickActions({
  items,
  onAction,
}: {
  items: QuickAction[]
  onAction: (action: string) => void
}) {
  if (items.length === 0) return null
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-0.5">
      {items.map((action) => {
        const isPrimary = action.priority === "high"
        return (
          <button
            key={action.id}
            onClick={() => onAction(action.action)}
            title={action.description}
            className={
              isPrimary
                ? "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md bg-ink px-2.5 text-[12px] font-medium text-canvas transition-colors duration-120 hover:bg-ink/90 active:scale-[0.99]"
                : "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-[12px] font-medium text-ink transition-colors duration-120 hover:bg-surface-secondary active:scale-[0.99]"
            }
          >
            {getActionIcon(action.icon)}
            <span className="whitespace-nowrap">{action.label}</span>
            {isPrimary ? (
              <ArrowRight className="size-3" strokeWidth={1.5} />
            ) : (
              <ArrowUpRight className="size-3" strokeWidth={1.5} />
            )}
          </button>
        )
      })}
    </div>
  )
}