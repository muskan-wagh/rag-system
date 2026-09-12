"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { Bell, Calendar, Inbox, ArrowRight, Eye, Send, FileText, UserPlus } from "lucide-react"
import { useDashboard, DASHBOARD_PAGE_SIZE } from "@/hooks/use-dashboard"
import { ROUTES } from "@/lib/constants"
import { cn } from "@/lib/utils"

function formatTimeAgo(dateStr: string) {
  const now = Date.now()
  const diffMins = Math.floor((now - new Date(dateStr).getTime()) / 60000)
  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

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

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOutside: () => void) {
  useEffect(() => {
    function handler(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside()
    }
    document.addEventListener("mousedown", handler)
    document.addEventListener("touchstart", handler)
    return () => {
      document.removeEventListener("mousedown", handler)
      document.removeEventListener("touchstart", handler)
    }
  }, [ref, onOutside])
}

function NotificationsContent({ onNavigated }: { onNavigated: () => void }) {
  const router = useRouter()
  // Same key as the dashboard page -> SWR dedupes to a single /dashboard request.
  const { upcomingInterviews, candidatesRequiringReview, recentActivity } = useDashboard(1, DASHBOARD_PAGE_SIZE)

  const today = new Date().toISOString().split("T")[0]
  const interviewsToday = upcomingInterviews.filter((i) => i.scheduled_date === today)

  const count = interviewsToday.length + candidatesRequiringReview.length
  const feed = recentActivity.slice(0, 6)
  const unread = count + feed.length

  const go = (href: string) => {
    router.push(href)
    onNavigated()
  }

  return (
    <div className="w-[calc(100vw-2rem)] max-w-[360px]">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="text-[13px] font-medium text-ink">Notifications</p>
          {unread > 0 && (
            <p className="mt-0.5 text-[11px] text-faint">
              {unread} item{unread === 1 ? "" : "s"} for your attention
            </p>
          )}
        </div>
        {count > 0 && (
          <Link
            href={ROUTES.interview}
            onClick={onNavigated}
            className="text-[11px] font-medium text-muted transition-colors duration-120 hover:text-ink"
          >
            View calendar
          </Link>
        )}
      </div>

      <div className="max-h-[360px] overflow-y-auto">
        {unread === 0 ? (
          <div className="flex flex-col items-center px-4 py-10 text-center">
            <div className="mb-3 flex size-10 items-center justify-center rounded-md bg-surface-secondary">
              <Bell className="size-4 text-faint" strokeWidth={1.5} />
            </div>
            <p className="text-[13px] font-medium text-ink">You’re all caught up</p>
            <p className="mt-1 max-w-[220px] text-[12px] leading-relaxed text-muted">
              Interviews, reviews, and activity will show up here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {interviewsToday.length > 0 && (
              <li className="px-4 py-3">
                <button
                  onClick={() => go(ROUTES.interview)}
                  className="flex w-full items-center gap-3 rounded-md text-left transition-colors duration-120"
                >
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-soft text-muted">
                    <Calendar className="size-3.5" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-ink">
                      {interviewsToday.length} interview
                      {interviewsToday.length === 1 ? "" : "s"} today
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-muted">
                      {interviewsToday
                        .map((i) => i.candidate_name || "Candidate")
                        .join(", ")}
                    </p>
                  </div>
                  <span className="shrink-0 rounded bg-info/10 px-1.5 py-0.5 text-[10px] font-medium text-info">
                    Today
                  </span>
                </button>
              </li>
            )}

            {candidatesRequiringReview.length > 0 && (
              <li className="px-4 py-3">
                <button
                  onClick={() => go(`${ROUTES.candidates}?status=applied`)}
                  className="flex w-full items-center gap-3 rounded-md text-left transition-colors duration-120"
                >
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-soft text-muted">
                    <Inbox className="size-3.5" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-ink">
                      {candidatesRequiringReview.length} candidate
                      {candidatesRequiringReview.length === 1 ? "" : "s"} need review
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-muted">
                      Waiting more than 48 hours
                    </p>
                  </div>
                  <span className="shrink-0 rounded bg-soft px-1.5 py-0.5 text-[10px] font-medium text-muted">
                    {candidatesRequiringReview.length}
                  </span>
                </button>
              </li>
            )}

            {feed.length > 0 && (
              <li className="px-4 pt-2.5 pb-1">
                <p className="text-[10px] font-medium uppercase tracking-[0.07em] text-faint">
                  Recent activity
                </p>
              </li>
            )}
            {feed.map((item) => (
              <li key={item.id} className="px-4 py-2.5">
                <button
                  onClick={() => go(ROUTES.history)}
                  className="flex w-full items-center gap-3 rounded-md text-left transition-colors duration-120"
                >
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-muted">
                    {getActivityIcon(item.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-ink">{item.description}</p>
                    {item.candidate_name && (
                      <p className="mt-0.5 truncate text-[11px] text-muted">
                        {item.candidate_name}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 font-data text-[10px] text-faint">
                    {formatTimeAgo(item.created_at)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-border px-4 py-2.5">
        <Link
          href={ROUTES.history}
          onClick={onNavigated}
          className="text-[12px] font-medium text-muted transition-colors duration-120 hover:text-ink"
        >
          View full history
        </Link>
      </div>
    </div>
  )
}

export function NotificationsMenu() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useClickOutside(rootRef, () => setOpen(false))

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        setOpen(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "relative flex size-8 items-center justify-center rounded-md border transition-colors duration-120",
          open
            ? "border-border-hover bg-surface text-ink"
            : "border-border bg-surface text-muted hover:border-border-hover hover:text-ink",
        )}
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="size-4" strokeWidth={1.5} />
        <span className="absolute right-2 top-2 size-1.5 rounded-full bg-danger" aria-hidden />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.14, ease: [0.25, 0.1, 0.25, 1] }}
            className="absolute right-0 top-full z-50 mt-2 origin-top-right overflow-hidden rounded-lg border border-border bg-surface shadow-[0_20px_60px_rgba(0,0,0,0.16)]"
          >
            <NotificationsContent onNavigated={() => setOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}