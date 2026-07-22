"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { Calendar, Clock, Video, MapPin, ChevronRight } from "lucide-react"
import { ROUTES } from "@/lib/constants"
import type { UpcomingInterview } from "@/lib/types"

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const } },
}

function getInterviewIcon(type: string) {
  const t = type.toLowerCase()
  if (t.includes("google") || t.includes("meet") || t.includes("video")) return <Video className="size-3.5" strokeWidth={1.5} />
  if (t.includes("phone") || t.includes("call")) return <Clock className="size-3.5" strokeWidth={1.5} />
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

function formatDate(date: string) {
  if (!date) return ""
  const d = new Date(date + "T00:00:00")
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const todayStr = today.toISOString().split("T")[0]
  const tomorrowStr = tomorrow.toISOString().split("T")[0]
  if (date === todayStr) return "Today"
  if (date === tomorrowStr) return "Tomorrow"
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function UpcomingInterviews({ items }: { items: UpcomingInterview[] }) {
  return (
    <motion.div variants={itemVariants}>
      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="text-[18px] font-semibold text-ink" style={{ fontFamily: "var(--font-inter)", letterSpacing: "-0.01em" }}>
            Upcoming Interviews
          </h2>
          <p className="text-[13px] text-muted mt-0.5" style={{ fontFamily: "var(--font-inter)" }}>
            {items.length > 0 ? `${items.length} scheduled` : "No interviews scheduled"}
          </p>
        </div>
        {items.length > 0 && (
          <Link href="/interview" className="text-[13px] font-medium text-muted hover:text-ink transition-colors duration-120 inline-flex items-center gap-1" style={{ fontFamily: "var(--font-inter)" }}>
            Manage
            <ChevronRight className="size-3.5" strokeWidth={1.5} />
          </Link>
        )}
      </div>
      {items.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl px-6 flex items-center justify-center min-h-[180px]">
          <div className="flex flex-col items-center text-center">
            <div className="h-9 w-9 rounded-[10px] bg-[#F3F4F6] flex items-center justify-center mb-2.5">
              <Calendar className="h-4 w-4 text-info/40" strokeWidth={1.5} />
            </div>
            <p className="text-[13px] font-medium text-ink" style={{ fontFamily: "var(--font-inter)" }}>No interviews scheduled</p>
            <p className="text-[12px] text-muted mt-0.5" style={{ fontFamily: "var(--font-inter)" }}>Schedule interviews from candidate profiles.</p>
          </div>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl p-5 space-y-2">
          {items.map((item, i) => {
            const isToday = item.scheduled_date === new Date().toISOString().split("T")[0]
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
              >
                <div className={`px-1 py-2 rounded-[8px] flex items-center gap-3 transition-all duration-120 hover:bg-[#F9FAFB] ${isToday ? "border-l-2 border-info -ml-0.5 pl-2.5" : ""}`}>
                  <div className={`size-9 rounded-full flex items-center justify-center shrink-0 ${isToday ? "bg-info text-white" : "bg-[#F3F4F6] text-muted"}`}>
                    {getInterviewIcon(item.interview_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`${ROUTES.candidates}/${item.candidate_id}`} className="text-[14px] font-medium text-ink hover:text-muted transition-colors duration-120 truncate" style={{ fontFamily: "var(--font-inter)" }}>
                        {item.candidate_name || "Unknown"}
                      </Link>
                      {isToday && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-info text-white shrink-0" style={{ fontFamily: "var(--font-inter)" }}>
                          TODAY
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-muted truncate mt-0.5" style={{ fontFamily: "var(--font-inter)" }}>
                      {item.candidate_title || "No title"} · {item.interview_type || "Interview"}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[11px] text-muted inline-flex items-center gap-1" style={{ fontFamily: "var(--font-inter)" }}>
                        <Calendar className="size-3" strokeWidth={1.5} />
                        {formatDate(item.scheduled_date)}
                      </span>
                      <span className="text-[11px] text-muted inline-flex items-center gap-1 font-data">
                        <Clock className="size-3" strokeWidth={1.5} />
                        {formatTime(item.scheduled_time)}
                      </span>
                    </div>
                  </div>
                  {item.meeting_link && (
                    <a
                      href={item.meeting_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="size-8 rounded-full bg-[#F3F4F6] flex items-center justify-center hover:bg-ink hover:text-white transition-all duration-120 shrink-0"
                    >
                      <Video className="size-3.5" strokeWidth={1.5} />
                    </a>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}
