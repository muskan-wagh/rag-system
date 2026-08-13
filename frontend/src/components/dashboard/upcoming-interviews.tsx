"use client"

import Link from "next/link"
import { Video, Phone, MapPin, ChevronRight, Calendar } from "lucide-react"
import { PanelHeader } from "@/components/ui/panel-header"
import { EmptyState } from "@/components/ui/empty-state"
import { ROUTES } from "@/lib/constants"
import type { UpcomingInterview } from "@/lib/types"

function getInterviewIcon(type: string) {
  const t = type.toLowerCase()
  if (t.includes("google") || t.includes("meet") || t.includes("video")) {
    return <Video className="size-3.5" strokeWidth={1.5} />
  }
  if (t.includes("phone") || t.includes("call")) {
    return <Phone className="size-3.5" strokeWidth={1.5} />
  }
  return <MapPin className="size-3.5" strokeWidth={1.5} />
}

function formatTime(time: string) {
  if (!time) return ""
  const [h, m] = time.split(":")
  const hour = parseInt(h, 10)
  if (isNaN(hour)) return time
  const ampm = hour >= 12 ? "PM" : "AM"
  const display = hour % 12 || 12
  return `${display}:${m} ${ampm}`
}

const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "short" })

function formatDate(date: string) {
  if (!date) return ""
  const d = new Date(`${date}T00:00:00`)
  const today = new Date()
  const todayStr = today.toISOString().split("T")[0]
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split("T")[0]
  if (date === todayStr) return "Today"
  if (date === tomorrowStr) return "Tomorrow"
  return `${WEEKDAY.format(d)}, ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
}

export function UpcomingInterviews({ items }: { items: UpcomingInterview[] }) {
  const isToday = (date: string) => date === new Date().toISOString().split("T")[0]

  return (
    <section>
      <PanelHeader
        title="Upcoming Interviews"
        description={items.length > 0 ? `${items.length} scheduled` : "No interviews scheduled"}
        className="mb-3"
        action={
          items.length > 0 ? (
            <Link
              href="/interview"
              className="inline-flex items-center gap-1 text-[12px] font-medium text-muted transition-colors duration-120 hover:text-ink"
            >
              Manage
              <ChevronRight className="size-3.5" strokeWidth={1.5} />
            </Link>
          ) : undefined
        }
      />
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        {items.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No interviews scheduled"
            description="Schedule interviews from candidate profiles."
          />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => {
              const today = isToday(item.scheduled_date)
              return (
                <li key={item.id}>
                  <div className="flex items-center gap-3 px-4 py-3 transition-colors duration-120 hover:bg-hover-tone">
                    <div
                      className={`flex size-8 shrink-0 items-center justify-center rounded-md ${
                        today ? "bg-ink text-canvas" : "bg-surface-secondary text-muted"
                      }`}
                    >
                      {getInterviewIcon(item.interview_type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`${ROUTES.candidates}/${item.candidate_id}`}
                          className="truncate text-[13px] font-medium text-ink transition-colors hover:text-muted"
                        >
                          {item.candidate_name || "Unknown"}
                        </Link>
                        {today && (
                          <span className="shrink-0 rounded bg-ink px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-canvas">
                            Today
                          </span>
                        )}
                      </div>
                      <p className="truncate text-[11px] text-muted">
                        {item.candidate_title || ""}
                        {item.candidate_title ? " · " : ""}
                        {item.interview_type || "Interview"}
                      </p>
                      <p className="mt-0.5 font-data text-[11px] text-faint">
                        {formatDate(item.scheduled_date)} · {formatTime(item.scheduled_time)}
                      </p>
                    </div>
                    {item.meeting_link && (
                      <a
                        href={item.meeting_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-secondary text-muted transition-colors duration-120 hover:bg-ink hover:text-canvas"
                        aria-label="Join meeting"
                      >
                        <Video className="size-3.5" strokeWidth={1.5} />
                      </a>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}