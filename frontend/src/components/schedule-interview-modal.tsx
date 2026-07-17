"use client"

import { useState } from "react"
import { Loader2, Calendar as CalendarIcon } from "lucide-react"
import { toast } from "sonner"
import { useApi } from "@/hooks/use-api"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"

interface ScheduleInterviewModalProps {
  open: boolean
  onClose: () => void
  candidateId: string
  onSuccess?: () => void
}

const INTERVIEW_TYPES = [
  { value: "google_meet", label: "Google Meet" },
  { value: "zoom", label: "Zoom" },
  { value: "ms_teams", label: "Microsoft Teams" },
  { value: "phone", label: "Phone Call" },
  { value: "in_person", label: "In Person" },
]

export function ScheduleInterviewModal({
  open,
  onClose,
  candidateId,
  onSuccess,
}: ScheduleInterviewModalProps) {
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [type, setType] = useState("google_meet")
  const [interviewer, setInterviewer] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const api = useApi()

  const handleSubmit = async () => {
    if (!date || !time) {
      toast.error("Please select date and time")
      return
    }
    setSaving(true)
    try {
      const res = await api.scheduleInterview(candidateId, {
        scheduledDate: date,
        scheduledTime: time,
        interviewType: type,
        interviewerName: interviewer,
        notes,
      })
      if (res.success) {
        toast.success("Interview scheduled! Email sent to candidate.")
        onClose()
        onSuccess?.()
      } else {
        toast.error(res.error || "Failed to schedule interview")
      }
    } catch {
      toast.error("Failed to schedule interview")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Schedule Interview</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">Set up a new interview for this candidate</p>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Interview Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              {INTERVIEW_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Interviewer</label>
            <input
              type="text"
              value={interviewer}
              onChange={(e) => setInterviewer(e.target.value)}
              placeholder="e.g. Sarah Johnson"
              className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Schedule Interview
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
