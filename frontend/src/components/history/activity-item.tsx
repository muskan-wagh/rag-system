"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import {
  ArrowRight, Eye, Send, Calendar, FileText, UserPlus,
  Layers, Search, MessageSquare, Briefcase, Sparkles,
} from "lucide-react"
import type { HistoryEntry } from "@/lib/types"
import { ROUTES } from "@/lib/constants"

function getActivityIcon(actionType: string) {
  switch (actionType) {
    case "status_changed": return <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
    case "search_executed": return <Search className="h-4 w-4" strokeWidth={1.5} />
    case "candidate_viewed": return <Eye className="h-4 w-4" strokeWidth={1.5} />
    case "candidate_compared": return <Eye className="h-4 w-4" strokeWidth={1.5} />
    case "interview_scheduled": return <Calendar className="h-4 w-4" strokeWidth={1.5} />
    case "email_sent": return <Send className="h-4 w-4" strokeWidth={1.5} />
    case "offer_generated": return <Briefcase className="h-4 w-4" strokeWidth={1.5} />
    case "resume_uploaded": return <FileText className="h-4 w-4" strokeWidth={1.5} />
    case "note_added": return <MessageSquare className="h-4 w-4" strokeWidth={1.5} />
    case "resume_processed": return <Sparkles className="h-4 w-4" strokeWidth={1.5} />
    case "saved_search_created": return <Search className="h-4 w-4" strokeWidth={1.5} />
    case "talent_pool_created": return <Layers className="h-4 w-4" strokeWidth={1.5} />
    case "candidate_added_to_pool": return <UserPlus className="h-4 w-4" strokeWidth={1.5} />
    default: return <UserPlus className="h-4 w-4" strokeWidth={1.5} />
  }
}

function getActivityColor(actionType: string) {
  switch (actionType) {
    case "status_changed": return "bg-warning/10 text-warning"
    case "search_executed": return "bg-muted/10 text-muted"
    case "candidate_viewed": return "bg-ink/5 text-ink"
    case "candidate_compared": return "bg-ink/5 text-ink"
    case "interview_scheduled": return "bg-ink/10 text-ink"
    case "email_sent": return "bg-success/10 text-success"
    case "offer_generated": return "bg-info/10 text-info"
    case "resume_uploaded": return "bg-success/10 text-success"
    case "note_added": return "bg-surface-secondary text-muted"
    case "resume_processed": return "bg-ink/10 text-ink"
    case "saved_search_created": return "bg-info/10 text-info"
    case "talent_pool_created": return "bg-info/10 text-info"
    case "candidate_added_to_pool": return "bg-info/10 text-info"
    default: return "bg-surface-secondary text-muted"
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

export function ActivityItem({ entry, index }: { entry: HistoryEntry; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <div className="flex items-start gap-4 px-6 py-4 hover:bg-[#F9FAFB] transition-colors">
        <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${getActivityColor(entry.action_type)}`}>
          {getActivityIcon(entry.action_type)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-ink">{entry.description}</p>
          <div className="flex items-center gap-3 mt-1">
            {entry.candidate_name && (
              <Link
                href={`${ROUTES.candidates}/${entry.candidate_id}`}
                className="text-xs font-medium text-muted hover:text-ink transition-colors"
              >
                {entry.candidate_name}
              </Link>
            )}
            <span className="font-data text-[12px] text-faint">{formatTimeAgo(entry.created_at)}</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
