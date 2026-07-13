"use client"

import { useState } from "react"
import { Loader2, Gift } from "lucide-react"
import { toast } from "sonner"
import { makeOffer } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"

interface MakeOfferModalProps {
  open: boolean
  onClose: () => void
  candidateId: string
  onSuccess?: () => void
}

export function MakeOfferModal({ open, onClose, candidateId, onSuccess }: MakeOfferModalProps) {
  const [salary, setSalary] = useState("")
  const [joiningDate, setJoiningDate] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    setSaving(true)
    try {
      const res = await makeOffer(candidateId, {
        salary: salary ? parseFloat(salary) : undefined,
        joiningDate: joiningDate || undefined,
        notes,
      })
      if (res.success) {
        toast.success("Offer sent to candidate!")
        onClose()
        onSuccess?.()
      } else {
        toast.error(res.error || "Failed to send offer")
      }
    } catch {
      toast.error("Failed to send offer")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center gap-2 text-green-600">
            <Gift className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Make an Offer</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">Extend an employment offer to this candidate</p>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Salary <span className="text-muted-foreground/60">(optional)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <input
                  type="number"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  placeholder="0"
                  className="w-full h-9 pl-7 pr-3 text-sm rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Joining Date <span className="text-muted-foreground/60">(optional)</span>
              </label>
              <input
                type="date"
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
                className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Notes <span className="text-muted-foreground/60">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Offer details, terms, or additional notes..."
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Send Offer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
