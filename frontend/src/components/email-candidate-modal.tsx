"use client"

import { useState, useCallback } from "react"
import { Loader2, Mail, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { useApi } from "@/hooks/use-api"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"

interface EmailCandidateModalProps {
  open: boolean
  onClose: () => void
  candidateId: string
  candidateName: string
  onSuccess?: () => void
}

export function EmailCandidateModal({
  open,
  onClose,
  candidateId,
  candidateName,
  onSuccess,
}: EmailCandidateModalProps) {
  const [generating, setGenerating] = useState(false)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)
  const [hasGenerated, setHasGenerated] = useState(false)
  const api = useApi()

  const generate = useCallback(async () => {
    setGenerating(true)
    try {
      const res = await api.generateEmailTemplate(candidateId)
      if (res.success && res.data) {
        setSubject(res.data.subject || "")
        setBody(res.data.body || "")
        setHasGenerated(true)
      } else {
        toast.error(res.error || "Failed to generate email template")
      }
    } catch {
      toast.error("Failed to generate email template")
    } finally {
      setGenerating(false)
    }
  }, [candidateId])

  // Trigger generation on first open
  if (open && !hasGenerated && !generating) {
    generate()
  }
  if (!open && hasGenerated) {
    setHasGenerated(false)
    setSubject("")
    setBody("")
  }

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error("Subject and body are required")
      return
    }
    setSending(true)
    try {
      const res = await api.sendInterviewEmail(candidateId, undefined, subject, body)
      if (res.success) {
        toast.success(`Email sent to ${candidateName}`)
        onClose()
        onSuccess?.()
      } else {
        toast.error(res.error || "Failed to send email")
      }
    } catch {
      toast.error("Failed to send email")
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Send Email to {candidateName}</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            AI-generated interview invitation — review and edit before sending
          </p>
        </div>

        {generating ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-2">
              <Sparkles className="h-8 w-8 text-primary animate-pulse" />
              <p className="text-sm text-muted-foreground">Generating email template with AI...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 px-6 pb-6">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Email Body</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={14}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none font-mono"
              />
            </div>
            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" size="sm" onClick={generate} disabled={generating}>
                <Sparkles className="h-3.5 w-3.5 mr-1" />
                Regenerate
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={onClose} disabled={sending}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSend} disabled={sending || generating}>
                  {sending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                  Send Email
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
