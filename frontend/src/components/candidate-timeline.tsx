"use client"

import { useEffect, useState } from "react"
import {
  CheckCircle2,
  Circle,
  XCircle,
  Clock,
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
  if (s === "hired") return <CheckCircle2 className="h-4 w-4 text-primary" />
  if (s === "rejected") return <XCircle className="h-4 w-4 text-red-500" />
  return <Circle className="h-4 w-4 text-muted-foreground/60" />
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
  }, [candidateId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (timeline.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No activity recorded yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="font-medium text-sm">Candidate Timeline</h3>
      <div className="relative">
        <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
        <div className="space-y-4">
          {timeline.map((entry, i) => (
            <div key={entry.id || i} className="flex items-start gap-3 relative">
              <div className="relative z-10 bg-white shrink-0 mt-0.5">
                {getStatusIcon(entry.status)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${getStatusColor(entry.status)}`}>
                    {entry.status}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDateTime(entry.changed_at)}
                  </span>
                </div>
                {entry.changed_by && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    by {entry.changed_by}
                  </p>
                )}
                {entry.details && Object.keys(entry.details).length > 0 && (
                  <div className="mt-1 text-xs text-muted-foreground">
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
    </div>
  )
}
