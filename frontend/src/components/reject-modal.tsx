"use client"

import { useState } from "react"
import { Loader2, XCircle } from "lucide-react"
import { toast } from "sonner"
import { useApi } from "@/hooks/use-api"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"

interface RejectModalProps {
  open: boolean
  onClose: () => void
  candidateId: string
  onSuccess?: () => void
}

const REJECT_REASONS = [
  { value: "not_qualified", label: "Not Qualified" },
  { value: "low_score", label: "Low Score" },
  { value: "experience_mismatch", label: "Experience Mismatch" },
  { value: "position_filled", label: "Position Filled" },
  { value: "other", label: "Other" },
]

export function RejectModal({ open, onClose, candidateId, onSuccess }: RejectModalProps) {
  const [reason, setReason] = useState("not_qualified")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const api = useApi()

  const handleReject = async () => {
    setSaving(true)
    try {
      const res = await api.rejectCandidate(candidateId, reason, notes)
      if (res.success) {
        toast.success("Candidate rejected")
        onClose()
        onSuccess?.()
      } else {
        toast.error(res.error || "Failed to reject candidate")
      }
    } catch {
      toast.error("Failed to reject candidate")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center gap-2 text-red-600">
            <XCircle className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Reject Candidate</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">This action will move the candidate out of the hiring pipeline.</p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Reason for Rejection</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            >
              {REJECT_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Recruiter Note <span className="text-muted-foreground/60">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional context..."
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleReject}
              disabled={saving}
            >
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Confirm Reject
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
