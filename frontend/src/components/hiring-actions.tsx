"use client"

import { ThumbsUp, ArrowRight, Calendar, CheckCircle2, Mail, Gift, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface Action {
  label: string
  action: string
  variant: "default" | "destructive" | "outline" | "emerald"
  icon: React.ElementType
}

const STATUS_ACTIONS: Record<string, Action[]> = {
  Applied: [
    { label: "Shortlist Candidate", action: "shortlisted", variant: "default", icon: ThumbsUp },
    { label: "Reject Applicant", action: "reject", variant: "destructive", icon: XCircle },
  ],
  Shortlisted: [
    { label: "Move to Screening", action: "screening", variant: "default", icon: ArrowRight },
    { label: "Reject", action: "reject", variant: "destructive", icon: XCircle },
  ],
  Screening: [
    { label: "Schedule Interview", action: "schedule-interview", variant: "default", icon: Calendar },
    { label: "Reject", action: "reject", variant: "destructive", icon: XCircle },
  ],
  "Interview Scheduled": [
    { label: "Mark Interview Completed", action: "interview-completed", variant: "default", icon: CheckCircle2 },
    { label: "Reschedule Interview", action: "reschedule", variant: "outline", icon: Calendar },
    { label: "Send Reminder Email", action: "send-reminder", variant: "outline", icon: Mail },
    { label: "Reject", action: "reject", variant: "destructive", icon: XCircle },
  ],
  "Interview Completed": [
    { label: "Move to Technical Round", action: "technical-round", variant: "default", icon: ArrowRight },
    { label: "Move to HR Round", action: "hr-round", variant: "default", icon: ArrowRight },
    { label: "Reject", action: "reject", variant: "destructive", icon: XCircle },
  ],
  "Technical Round": [
    { label: "Move to HR Round", action: "hr-round", variant: "default", icon: ArrowRight },
    { label: "Reject", action: "reject", variant: "destructive", icon: XCircle },
  ],
  "HR Round": [
    { label: "Make Offer", action: "make-offer", variant: "default", icon: Gift },
    { label: "Reject", action: "reject", variant: "destructive", icon: XCircle },
  ],
  Offered: [
    { label: "Mark as Hired", action: "hired", variant: "emerald", icon: CheckCircle2 },
    { label: "Reject Offer", action: "reject", variant: "destructive", icon: XCircle },
  ],
}

interface HiringActionsProps {
  currentStatus: string
  onAction: (action: string) => void
  loading?: boolean
}

export function HiringActions({ currentStatus, onAction, loading }: HiringActionsProps) {
  const actions = STATUS_ACTIONS[currentStatus] || []

  if (!actions || actions.length === 0) {
    if (currentStatus === "Hired") {
      return (
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
          <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1" />
          <p className="text-sm font-medium text-emerald-700">Candidate Hired</p>
          <p className="text-xs text-emerald-600">This candidate has accepted the offer and joined.</p>
        </div>
      )
    }
    if (currentStatus === "Rejected") {
      return (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-center">
          <XCircle className="h-6 w-6 text-red-500 mx-auto mb-1" />
          <p className="text-sm font-medium text-red-700">Candidate Rejected</p>
          <p className="text-xs text-red-600">This candidate is no longer in the pipeline.</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="font-medium text-sm">Hiring Actions</h3>
        <Badge variant="outline" className="text-[10px]">{currentStatus}</Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.action}
            variant={action.variant === "emerald" ? "default" : action.variant}
            size="sm"
            onClick={() => onAction(action.action)}
            disabled={loading}
            className={action.variant === "emerald" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
          >
            <action.icon className="h-3.5 w-3.5 mr-1.5" />
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
