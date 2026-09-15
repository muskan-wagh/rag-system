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

function localTodayStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function formatDate(date: string) {
  if (!date) return ""
  const d = new Date(`${date}T00:00:00`)
  const todayStr = localTodayStr()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = localTodayStr(tomorrow)
  if (date === todayStr) return "Today"
  if (date === tomorrowStr) return "Tomorrow"
  if (date < todayStr) return `Overdue · ${WEEKDAY.format(d)}, ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
  return `${WEEKDAY.format(d)}, ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
}

export function UpcomingInterviews({ items }: { items: UpcomingInterview[] }) {
  const todayStr = localTodayStr()
  const isToday = (date: string) => date === todayStr
  const isOverdue = (date: string) => !!date && date < todayStr

  return (
    <section className="min-w-0">
      <PanelHeader
        title="Upcoming Interviews"
        description={items.length > 0 ? `${items.length} scheduled` : "No interviews scheduled"}
        className="mb-2"
        action={
          items.length > 0 ? (
            <Link
              href="/interview"
              className="group inline-flex items-center gap-1 text-[12px] font-medium text-muted transition-colors duration-120 hover:text-ink"
            >
              Manage
              <ChevronRight className="size-3.5 transition-transform duration-120 group-hover:translate-x-px" strokeWidth={1.5} />
            </Link>
          ) : undefined
        }
      />
      <div className="overflow-hidden rounded-md border border-border bg-surface">
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
              const overdue = !today && isOverdue(item.scheduled_date)
              return (
                <li key={item.id}>
                  <div className="flex min-w-0 items-center gap-2.5 px-3 py-2.5 transition-colors duration-120 hover:bg-hover-tone">
                    <div
                      className={`flex size-7 shrink-0 items-center justify-center rounded-md transition-colors duration-120 ${
                        today ? "bg-ink text-canvas" : "bg-surface-secondary text-muted"
                      }`}
                    >
                      {getInterviewIcon(item.interview_type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <Link
                          href={`${ROUTES.candidates}/${item.candidate_id}`}
                          className="truncate text-[12.5px] font-medium text-ink transition-colors hover:text-muted"
                        >
                          {item.candidate_name || "Unknown"}
                        </Link>
                        {today && (
                          <span className="shrink-0 rounded bg-ink px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-canvas">
                            Today
                          </span>
                        )}
                        {overdue && (
                          <span className="shrink-0 rounded bg-danger/10 px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-danger">
                            Overdue
                          </span>
                        )}
                      </div>
                      <p className="truncate text-[11px] text-muted">
                        {item.candidate_title || ""}
                        {item.candidate_title ? " · " : ""}
                        {item.interview_type || "Interview"}
                      </p>
                      <p className="mt-px font-data text-[11px] text-faint">
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