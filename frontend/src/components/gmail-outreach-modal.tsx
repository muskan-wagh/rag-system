"use client"

import { useState, useCallback, useEffect, useRef, startTransition } from "react"
import { Loader2, Sparkles, CheckCircle2, AlertCircle, Link2Off, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { useApi } from "@/hooks/use-api"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { GmailLogo } from "@/components/gmail-logo"
import { cn } from "@/lib/utils"

function GmailMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-secondary",
        className,
      )}
    >
      <GmailLogo className="size-5" />
    </span>
  )
}

interface GmailOutreachModalProps {
  open: boolean
  onClose: () => void
  candidateId: string
  candidateName: string
  candidateEmail: string
  onSent?: () => void
}

type GmailState = "checking" | "connected" | "disconnected" | "unconfigured"
type SendState = "idle" | "sending" | "sent" | "error"

export function GmailOutreachModal({
  open,
  onClose,
  candidateId,
  candidateName,
  candidateEmail,
  onSent,
}: GmailOutreachModalProps) {
  const api = useApi()
  const [gmailState, setGmailState] = useState<GmailState>("checking")
  const [gmailEmail, setGmailEmail] = useState("")
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState("")
  const [to, setTo] = useState(candidateEmail)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [hasGenerated, setHasGenerated] = useState(false)

  const [sendState, setSendState] = useState<SendState>("idle")
  const [sendError, setSendError] = useState("")
  const [sentFrom, setSentFrom] = useState("")
  const popupRef = useRef<Window | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const refreshGmailStatus = useCallback(async () => {
    try {
      const res = await api.getGmailStatus()
      if (res.success && res.data) {
        if (!res.data.configured) {
          setGmailState("unconfigured")
          setGmailEmail("")
        } else if (res.data.connected) {
          setGmailState("connected")
          setGmailEmail(res.data.email)
        } else {
          setGmailState("disconnected")
          setGmailEmail("")
        }
        return res.data.connected
      }
    } catch {
      // Keep previous state on transient failure
    }
    return false
  }, [api])

  const generate = useCallback(async () => {
    setGenerating(true)
    setGenError("")
    try {
      const res = await api.generateOutreachEmail(candidateId)
      if (res.success && res.data) {
        setTo(res.data.to || candidateEmail)
        setSubject(res.data.subject || "")
        setBody(res.data.body || "")
        setHasGenerated(true)
      } else {
        setGenError(res.error || "Failed to generate outreach email")
      }
    } catch {
      setGenError("Failed to connect to server")
    } finally {
      setGenerating(false)
    }
  }, [api, candidateId, candidateEmail])

  // NOTE: the parent mounts this modal fresh on every open (see candidates/[id]/page.tsx),
  // so initial useState values above are the reset. This effect only kicks off
  // async work (status check + generation) and the popup postMessage listener.
  useEffect(() => {
    startTransition(() => {
      refreshGmailStatus()
      generate()
    })
    const onMessage = (e: MessageEvent) => {
      if (typeof e.data === "object" && e.data?.type === "hirestack-gmail-connected") {
        if (e.data.ok) {
          refreshGmailStatus()
          toast.success("Gmail connected")
        } else {
          toast.error("Gmail connection failed. Please try again.")
        }
        setConnecting(false)
        stopPolling()
        try { popupRef.current?.close() } catch { /* noop */ }
      }
    }
    window.addEventListener("message", onMessage)
    return () => {
      window.removeEventListener("message", onMessage)
      stopPolling()
      try { popupRef.current?.close() } catch { /* noop */ }
    }
    // Mount-only: parent remounts per open, callbacks are stable via useCallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleConnect = useCallback(async () => {
    setConnecting(true)
    try {
      const res = await api.getGmailAuthUrl()
      if (!res.success || !res.data?.url) {
        toast.error(res.error || "Could not start Gmail connection")
        setConnecting(false)
        return
      }
      // Popup keeps the candidate profile + draft state intact.
      popupRef.current = window.open(
        res.data.url,
        "hirestack-gmail-connect",
        "width=520,height=680,menubar=no,toolbar=no",
      )
      if (!popupRef.current) {
        // Popup blocked — fall back to same-tab navigation hint
        toast.error("Popup blocked. Allow popups, then try Connect Gmail again.")
        setConnecting(false)
        return
      }
      // Fallback: poll status in case postMessage is blocked (cross-origin edge).
      let attempts = 0
      stopPolling()
      pollRef.current = setInterval(async () => {
        attempts += 1
        if (popupRef.current?.closed) {
          stopPolling()
          setConnecting(false)
          refreshGmailStatus()
          return
        }
        const connected = await refreshGmailStatus()
        if (connected) {
          stopPolling()
          setConnecting(false)
          toast.success("Gmail connected")
          try { popupRef.current?.close() } catch { /* noop */ }
        } else if (attempts > 45) {
          stopPolling()
          setConnecting(false)
        }
      }, 2000)
    } catch {
      toast.error("Could not start Gmail connection")
      setConnecting(false)
    }
  }, [api, refreshGmailStatus, stopPolling])

  const handleDisconnect = useCallback(async () => {
    setDisconnecting(true)
    try {
      const res = await api.disconnectGmail()
      if (res.success) {
        setGmailState("disconnected")
        setGmailEmail("")
        toast.success("Gmail disconnected")
      } else {
        toast.error(res.error || "Failed to disconnect Gmail")
      }
    } catch {
      toast.error("Failed to disconnect Gmail")
    } finally {
      setDisconnecting(false)
    }
  }, [api])

  const handleSend = useCallback(async () => {
    // Explicit recruiter approval: never auto-send; always validate first.
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRe.test(to.trim())) {
      setSendError("Enter a valid recipient email address.")
      setSendState("error")
      return
    }
    if (!subject.trim() || !body.trim()) {
      setSendError("Subject and body are required.")
      setSendState("error")
      return
    }
    if (gmailState !== "connected") {
      setSendError("Connect Gmail before sending.")
      setSendState("error")
      return
    }
    setSendState("sending")
    setSendError("")
    try {
      const res = await api.sendGmailOutreach(candidateId, {
        to: to.trim(),
        subject: subject.trim(),
        body,
      })
      if (res.success) {
        setSendState("sent")
        setSentFrom(res.data?.from || gmailEmail)
        toast.success(`Email sent to ${candidateName}`)
        onSent?.()
      } else {
        setSendState("error")
        const code = (res as unknown as { code?: string }).code
        if (code === "GMAIL_NOT_CONNECTED" || code === "REAUTH_REQUIRED") {
          setSendError(res.error || "Gmail needs reconnecting. Please connect Gmail again.")
          refreshGmailStatus()
        } else {
          setSendError(res.error || "Failed to send via Gmail")
        }
      }
    } catch {
      setSendState("error")
      setSendError("Failed to connect to server")
    }
  }, [api, body, candidateId, candidateName, gmailEmail, gmailState, onSent, refreshGmailStatus, subject, to])

  const canSend = gmailState === "connected" && hasGenerated && !generating && sendState !== "sending"

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <GmailMark />
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] font-medium text-ink truncate">
                Outreach to {candidateName}
              </h2>
              <p className="text-xs text-muted mt-0.5">
                AI-personalized draft via Gmail — review and edit before sending
              </p>
            </div>
          </div>

          {/* From / connection row */}
          <div className="mt-3 rounded-lg bg-surface-secondary px-3 py-2.5 flex items-center gap-2 flex-wrap">
            {gmailState === "checking" && (
              <span className="flex items-center gap-2 text-xs text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Checking Gmail connection…
              </span>
            )}
            {gmailState === "connected" && (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                <span className="text-xs text-muted">Sending from:</span>
                <span className="text-xs font-medium text-ink truncate">{gmailEmail}</span>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting || sendState === "sending"}
                  className="ml-auto text-xs text-muted hover:text-danger transition-colors disabled:opacity-50"
                >
                  {disconnecting ? "Disconnecting…" : "Disconnect"}
                </button>
              </>
            )}
            {gmailState === "disconnected" && (
              <>
                <AlertCircle className="h-3.5 w-3.5 text-warning shrink-0" />
                <span className="text-xs text-muted">Gmail not connected — connect to send from your account.</span>
                <Button size="xs" onClick={handleConnect} disabled={connecting} className="ml-auto">
                  {connecting && <Loader2 className="h-3 w-3 animate-spin" />}
                  {connecting ? "Waiting for Gmail…" : "Connect Gmail"}
                </Button>
              </>
            )}
            {gmailState === "unconfigured" && (
              <>
                <AlertCircle className="h-3.5 w-3.5 text-danger shrink-0" />
                <span className="text-xs text-muted">
                  Gmail is not configured on the server. Contact your admin.
                </span>
              </>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {generating ? (
            <div className="flex items-center justify-center py-14">
              <div className="flex flex-col items-center gap-2.5">
                <Sparkles className="h-7 w-7 text-ink animate-pulse-soft" />
                <p className="text-[13px] text-muted">Generating personalized outreach…</p>
                <p className="text-[11px] text-faint">Using skills, experience, projects and the target role</p>
              </div>
            </div>
          ) : genError && !hasGenerated ? (
            <div className="py-10 text-center">
              <AlertCircle className="h-7 w-7 text-danger mx-auto mb-2" />
              <p className="text-[13px] text-ink font-medium">Couldn&apos;t generate the draft</p>
              <p className="text-xs text-muted mt-1">{genError}</p>
              <Button size="sm" variant="outline" onClick={generate} className="mt-4">
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </Button>
            </div>
          ) : (
            <div className="space-y-3.5">
              <div>
                <label className="text-[11px] font-medium uppercase tracking-[0.05em] text-faint mb-1.5 block">
                  To
                </label>
                <input
                  type="email"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="candidate@email.com"
                  className="w-full h-9 px-3 text-[13px] rounded-lg border border-border bg-surface text-ink outline-none placeholder:text-faint focus:border-border-hover transition-colors"
                />
                {!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim()) && to.length > 0 && (
                  <p className="text-[11px] text-danger mt-1">Enter a valid email address.</p>
                )}
              </div>
              <div>
                <label className="text-[11px] font-medium uppercase tracking-[0.05em] text-faint mb-1.5 block">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Opportunity at Company"
                  className="w-full h-9 px-3 text-[13px] rounded-lg border border-border bg-surface text-ink outline-none placeholder:text-faint focus:border-border-hover transition-colors"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium uppercase tracking-[0.05em] text-faint mb-1.5 block">
                  Message — edit before sending
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={13}
                  className="w-full px-3 py-2.5 text-[13px] leading-relaxed rounded-lg border border-border bg-surface text-ink outline-none focus:border-border-hover transition-colors resize-y min-h-[240px]"
                />
              </div>

              {sendState === "sent" && (
                <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2.5">
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[13px] font-medium text-ink">✓ Email sent successfully</p>
                    {sentFrom && (
                      <p className="text-[11px] text-muted mt-0.5">Sent from {sentFrom} via Gmail</p>
                    )}
                  </div>
                </div>
              )}
              {sendState === "error" && sendError && (
                <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5">
                  <AlertCircle className="h-4 w-4 text-danger shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-[13px] text-ink">{sendError}</p>
                    {(sendError.toLowerCase().includes("reconnect") || sendError.toLowerCase().includes("connect gmail")) && (
                      <Button size="xs" variant="outline" onClick={handleConnect} disabled={connecting} className="mt-2">
                        <Link2Off className="h-3 w-3" />
                        {connecting ? "Waiting for Gmail…" : "Connect Gmail"}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-border shrink-0 flex items-center gap-2 flex-wrap bg-surface">
          <Button variant="outline" size="sm" onClick={generate} disabled={generating || sendState === "sending"}>
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {generating ? "Generating…" : "Regenerate"}
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={sendState === "sending"}>
              {sendState === "sent" ? "Close" : "Cancel"}
            </Button>
            {sendState !== "sent" && (
              <Button size="sm" onClick={handleSend} disabled={!canSend}>
                {sendState === "sending" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {sendState === "sending" ? "Sending…" : "Send via Gmail"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
