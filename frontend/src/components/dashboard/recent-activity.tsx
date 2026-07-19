"use client"

import { motion } from "framer-motion"
import { History, ArrowRight, Eye, Send, Calendar, FileText, UserPlus } from "lucide-react"
import type { RecentActivityItem } from "@/lib/types"
import { ROUTES } from "@/lib/constants"
import Link from "next/link"

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const } },
}

function getActivityIcon(type: string) {
  switch (type) {
    case "status_change": return <ArrowRight className="size-[14px]" strokeWidth={1.5} />
    case "search": return <Eye className="size-[14px]" strokeWidth={1.5} />
    case "interview": return <Calendar className="size-[14px]" strokeWidth={1.5} />
    case "upload": return <FileText className="size-[14px]" strokeWidth={1.5} />
    case "offer": return <Send className="size-[14px]" strokeWidth={1.5} />
    default: return <UserPlus className="size-[14px]" strokeWidth={1.5} />
  }
}

function formatTimeAgo(dateStr: string) {
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
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
    <motion.div variants={itemVariants}>
      <div className="flex items-end justify-between mb-5">
        <div>
          <h2 className="text-[20px] font-medium text-ink" style={{ fontFamily: "var(--font-inter)", letterSpacing: "-0.01em" }}>
            Recent Activity
          </h2>
          <p className="text-sm text-muted mt-1" style={{ fontFamily: "var(--font-inter)" }}>
            Latest recruiter actions
          </p>
        </div>
        {items.length > 0 && (
          <Link href={ROUTES.history} className="text-sm font-medium text-muted hover:text-ink transition-colors duration-120 inline-flex items-center gap-1" style={{ fontFamily: "var(--font-inter)" }}>
            View all
          </Link>
        )}
      </div>
      {items.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-8">
          <div className="flex flex-col items-center text-center">
            <div className="h-10 w-10 rounded-[10px] bg-[#F3F4F6] flex items-center justify-center mb-3">
              <History className="h-5 w-5 text-info/40" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-ink" style={{ fontFamily: "var(--font-inter)" }}>No activity yet</p>
            <p className="text-xs text-muted mt-1" style={{ fontFamily: "var(--font-inter)" }}>Start using RecruitIQ to see your activity here.</p>
          </div>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl divide-y divide-border">
          {items.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03, duration: 0.3 }}
              className="flex items-center gap-4 px-6 py-4 hover:bg-[#F9FAFB] transition-colors duration-120"
            >
              <div className="size-8 rounded-full bg-[#F3F4F6] flex items-center justify-center shrink-0 text-muted">
                {getActivityIcon(item.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink truncate" style={{ fontFamily: "var(--font-inter)" }}>{item.description}</p>
                {item.candidate_name && (
                  <p className="text-xs text-muted mt-0.5" style={{ fontFamily: "var(--font-inter)" }}>Related to {item.candidate_name}</p>
                )}
              </div>
              <span className="font-data text-[12px] text-faint whitespace-nowrap shrink-0">{formatTimeAgo(item.created_at)}</span>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
