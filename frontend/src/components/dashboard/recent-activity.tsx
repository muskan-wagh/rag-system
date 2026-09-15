"use client"

import Link from "next/link"
import { History, ArrowRight, Eye, Calendar, FileText, Send, UserPlus, ChevronRight } from "lucide-react"
import { PanelHeader } from "@/components/ui/panel-header"
import { EmptyState } from "@/components/ui/empty-state"
import type { RecentActivityItem } from "@/lib/types"
import { ROUTES } from "@/lib/constants"

function getActivityIcon(type: string) {
  switch (type) {
    case "status_change":
      return <ArrowRight className="size-3.5" strokeWidth={1.5} />
    case "search":
      return <Eye className="size-3.5" strokeWidth={1.5} />
    case "interview":
      return <Calendar className="size-3.5" strokeWidth={1.5} />
    case "upload":
      return <FileText className="size-3.5" strokeWidth={1.5} />
    case "offer":
      return <Send className="size-3.5" strokeWidth={1.5} />
    default:
      return <UserPlus className="size-3.5" strokeWidth={1.5} />
  }
}

function getActivityColor(type: string) {
  switch (type) {
    case "status_change":
    case "upload":
    case "search":
      return "text-info"
    case "interview":
      return "text-warning"
    case "offer":
      return "text-success"
    default:
      return "text-muted"
  }
}

function formatTimeAgo(dateStr: string) {
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  const diffMins = Math.floor((now - date) / 60000)
  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function RecentActivity({ items }: { items: RecentActivityItem[] }) {
  return (
    <section className="min-w-0">
      <PanelHeader
        title="Recent Activity"
        description="Latest recruiter actions"
        className="mb-2"
        action={
          items.length > 0 ? (
            <Link
              href={ROUTES.history}
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
            icon={History}
            title="No activity yet"
            description="Start using HireStack to see your activity here."
          />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex min-w-0 items-center gap-2.5 px-3 py-2.5 transition-colors duration-120 hover:bg-hover-tone"
              >
                <div className={`flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-secondary ${getActivityColor(item.type)}`}>
                  {getActivityIcon(item.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] text-ink">{item.description}</p>
                  {item.candidate_name && (
                    <p className="mt-0.5 truncate text-[11px] text-muted">
                      Related to {item.candidate_name}
                    </p>
                  )}
                </div>
                <span className="shrink-0 font-data text-[11px] text-faint">
                  {formatTimeAgo(item.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}