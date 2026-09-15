"use client"

import { useEffect, useState } from "react"
import {
  CircleCheck,
  Circle,
  CircleX,
  Clock,
  Calendar,
  Search,
  Upload,
  Gift,
  Loader2,
} from "lucide-react"
import { useApi } from "@/hooks/use-api"
import { getStatusColor } from "@/lib/constants"
import type { TimelineEntry } from "@/lib/api"

interface CandidateTimelineProps {
  candidateId: string
}

function formatDateTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return dateStr
  }
}

function getStatusIcon(status: string) {
  const s = status.toLowerCase()
  if (s === "hired") return <CircleCheck className="size-4 text-green-600" strokeWidth={1.75} />
  if (s === "offered" || s === "pending offer") return <Gift className="size-4 text-green-600" strokeWidth={1.75} />
  if (s === "rejected") return <CircleX className="size-4 text-red-500" strokeWidth={1.75} />
  if (
    s === "interview scheduled" ||
    s === "interview completed" ||
    s === "technical round" ||
    s === "hr round" ||
    s === "interview"
  )
    return <Calendar className="size-4 text-blue-600" strokeWidth={1.75} />
  if (s === "screening" || s === "shortlisted")
    return <Search className="size-4 text-amber-600" strokeWidth={1.75} />
  if (s === "applied") return <Upload className="size-4 text-amber-600" strokeWidth={1.75} />
  return <Circle className="size-4 text-muted-foreground/60" strokeWidth={1.75} />
}

function getRejectionReason(details: Record<string, unknown> | null): string | null {
  if (!details) return null
  const reason = details.rejection_reason as string
  if (!reason) return null
  const labels: Record<string, string> = {
    not_qualified: "Not Qualified",
    low_score: "Low Score",
    experience_mismatch: "Experience Mismatch",
    position_filled: "Position Filled",
    other: "Other",
  }
  return labels[reason] || reason
}

export function CandidateTimeline({ candidateId }: CandidateTimelineProps) {
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [loading, setLoading] = useState(true)
  const api = useApi()

  useEffect(() => {
    async function fetch() {
      try {
        const res = await api.getCandidateTimeline(candidateId)
        if (res.success && res.data) {
          setTimeline(res.data)
        }
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [candidateId, api])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" strokeWidth={1.75} />
      </div>
    )
  }

  if (timeline.length === 0) {
    return (
      <div className="py-8 text-center">
        <Clock className="mx-auto mb-2 size-6 text-muted-foreground/40" strokeWidth={1.5} />
        <p className="text-[12.5px] text-muted">No activity recorded yet</p>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="absolute bottom-2 left-[15px] top-2 w-px bg-border" />
      <div className="space-y-4">
        {timeline.map((entry, i) => (
          <div key={entry.id || i} className="relative flex items-start gap-3">
            <div className="relative z-10 mt-0.5 shrink-0 bg-surface">
              {getStatusIcon(entry.status)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${getStatusColor(entry.status)}`}>
                  {entry.status}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {formatDateTime(entry.changed_at)}
                </span>
              </div>
              {entry.changed_by && (
                <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                  by {entry.changed_by}
                </p>
              )}
              {entry.details && Object.keys(entry.details).length > 0 && (
                <div className="mt-1 text-[11.5px] text-muted-foreground">
                  {getRejectionReason(entry.details) && (
                    <span className="text-red-600">Reason: {getRejectionReason(entry.details)}</span>
                  )}
                  {(entry.details.interview_type as string) && (
                    <span>Type: {entry.details.interview_type as string}</span>
                  )}
                  {(entry.details.salary as number) && (
                    <span>Salary: ${entry.details.salary as number}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
