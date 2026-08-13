"use client"

import { Sparkles, Users, Calendar, Briefcase, ArrowUpRight, ArrowRight, Zap } from "lucide-react"
import type { QuickAction } from "@/lib/types"

function getActionIcon(icon: string) {
  switch (icon) {
    case "users":
      return <Users className="size-4" strokeWidth={1.5} />
    case "calendar":
      return <Calendar className="size-4" strokeWidth={1.5} />
    case "briefcase":
      return <Briefcase className="size-4" strokeWidth={1.5} />
    case "zap":
      return <Zap className="size-4" strokeWidth={1.5} />
    default:
      return <Sparkles className="size-4" strokeWidth={1.5} />
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
    <div className="flex flex-wrap gap-2">
      {items.map((action) => {
        const isPrimary = action.priority === "high"
        return (
          <button
            key={action.id}
            onClick={() => onAction(action.action)}
            className={
              isPrimary
                ? "inline-flex items-center gap-2 rounded-lg bg-ink px-3.5 py-2 text-[13px] font-medium text-canvas transition-colors duration-120 hover:bg-ink/90 active:scale-[0.99]"
                : "inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-[13px] font-medium text-ink transition-colors duration-120 hover:bg-surface-secondary active:scale-[0.99]"
            }
          >
            {getActionIcon(action.icon)}
            <span>{action.label}</span>
            {isPrimary ? (
              <ArrowRight className="size-3.5" strokeWidth={1.5} />
            ) : (
              <ArrowUpRight className="size-3.5" strokeWidth={1.5} />
            )}
          </button>
        )
      })}
    </div>
  )
}