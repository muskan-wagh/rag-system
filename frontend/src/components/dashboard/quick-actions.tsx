"use client"

import { Sparkles, Users, Calendar, Briefcase, ArrowRight, Zap } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { QuickAction } from "@/lib/types"
import { cn } from "@/lib/utils"

const ICONS: Record<string, LucideIcon> = {
  users: Users,
  calendar: Calendar,
  briefcase: Briefcase,
  zap: Zap,
}

export function QuickActions({
  items,
  onAction,
}: {
  items: QuickAction[]
  onAction: (action: string) => void
}) {
  if (!items || items.length === 0) return null

  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((action) => {
        const isPrimary = action.priority === "high"
        const Icon = ICONS[action.icon] ?? Sparkles
        return (
          <li key={action.id}>
            <button
              type="button"
              onClick={() => onAction(action.action)}
              title={action.description}
              className={cn(
                "group inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-[12.5px] font-medium transition-all duration-150",
                isPrimary
                  ? "bg-ink text-canvas hover:bg-ink-hover"
                  : "border border-border bg-surface text-ink hover:border-border-hover hover:bg-surface-secondary",
              )}
            >
              <Icon className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
              {action.label}
              <ArrowRight
                className="size-3 shrink-0 opacity-50 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:opacity-100"
                strokeWidth={2}
                aria-hidden
              />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
