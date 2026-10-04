"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Loader2, CheckCircle2, AlertCircle, Mail } from "lucide-react"
import { toast } from "sonner"
import { useApi } from "@/hooks/use-api"
import { Button } from "@/components/ui/button"
import { GmailLogo } from "@/components/gmail-logo"

type Status = "loading" | "connected" | "disconnected" | "unconfigured" | "error"

/**
 * Settings → Email Integration card (canonical /integrations/gmail endpoints).
 * The outreach modal keeps using legacy /gmail/* aliases — both hit the same
 * backend store, so connecting in either place updates the other.
 */
export function GmailSettingsCard() {
  const api = useApi()
  const [status, setStatus] = useState<Status>("loading")
  const [email, setEmail] = useState("")
  const [lastUsedAt, setLastUsedAt] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const popupRef = useRef<Window | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const refresh = useCallback(async () => {
    try {
      const res = await api.getGmailIntegration()
      if (!res.success || !res.data) {
        setStatus("error")
        return false
      }
      if (!res.data.configured) {
        setStatus("unconfigured")
        setEmail("")
        return false
      }
      if (res.data.connected) {
        setStatus("connected")
        setEmail(res.data.email || "")
        setLastUsedAt(res.data.lastUsedAt || null)
        return true
      }
      setStatus("disconnected")
      setEmail("")
      setLastUsedAt(null)
      return false
    } catch {
      setStatus("error")
      return false
    }
  }, [api])

  useEffect(() => {
    // Deferred to a microtask: the effect only kicks off the fetch and
    // subscribes, state updates happen in async callbacks
    // (react-hooks/set-state-in-effect).
    queueMicrotask(() => {
      void refresh()
    })
    const onMessage = (e: MessageEvent) => {
      if (typeof e.data === "object" && e.data?.type === "hirestack-gmail-connected") {
        if (e.data.ok) {
          void refresh()
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
  }, [refresh, stopPolling])

  const handleConnect = useCallback(async () => {
    setConnecting(true)
    try {
      const res = await api.getGmailIntegrationAuthUrl()
      if (!res.success || !res.data?.url) {
        toast.error(res.error || "Could not start Gmail connection")
        setConnecting(false)
        return
      }
      popupRef.current = window.open(res.data.url, "hirestack-gmail-connect", "width=520,height=680,menubar=no,toolbar=no")
      if (!popupRef.current) {
        toast.error("Popup blocked. Allow popups, then try Connect Gmail again.")
        setConnecting(false)
        return
      }
      let attempts = 0
      stopPolling()
      pollRef.current = setInterval(async () => {
        attempts += 1
        if (popupRef.current?.closed) {
          stopPolling()
          setConnecting(false)
          refresh()
          return
        }
        const connected = await refresh()
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
  }, [api, refresh, stopPolling])

  const handleDisconnect = useCallback(async () => {
    setDisconnecting(true)
    try {
      const res = await api.disconnectGmailIntegration()
      if (res.success) {
        setStatus("disconnected")
        setEmail("")
        setLastUsedAt(null)
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

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-secondary">
          <GmailLogo className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] font-medium text-ink">Email Integration</h3>
          <p className="mt-0.5 text-[12px] text-muted">
            Connect Gmail to send candidate outreach from your own address. Resend keeps working independently.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-surface-secondary px-3 py-2.5">
        {status === "loading" && (
          <span className="flex items-center gap-2 text-xs text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking Gmail connection…
          </span>
        )}
        {status === "connected" && (
          <div className="flex items-center gap-2 flex-wrap">
            <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
            <span className="text-xs text-muted">Gmail Connected</span>
            <span className="text-xs font-medium text-ink truncate">{email}</span>
            <Button size="xs" variant="outline" onClick={handleDisconnect} disabled={disconnecting} className="ml-auto">
              {disconnecting ? "Disconnecting…" : "Disconnect Gmail"}
            </Button>
            {lastUsedAt && (
              <span className="w-full text-[11px] text-faint">
                Last used {new Date(lastUsedAt).toLocaleString()}
              </span>
            )}
          </div>
        )}
        {status === "disconnected" && (
          <div className="flex items-center gap-2 flex-wrap">
            <Mail className="h-3.5 w-3.5 text-muted shrink-0" />
            <span className="text-xs text-muted">Gmail not connected.</span>
            <Button size="xs" onClick={handleConnect} disabled={connecting} className="ml-auto">
              {connecting && <Loader2 className="h-3 w-3 animate-spin" />}
              {connecting ? "Waiting for Gmail…" : "Connect Gmail"}
            </Button>
          </div>
        )}
        {status === "unconfigured" && (
          <div className="flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-danger shrink-0" />
            <span className="text-xs text-muted">Gmail is not configured on the server. Contact your admin.</span>
          </div>
        )}
        {status === "error" && (
          <div className="flex items-center gap-2 flex-wrap">
            <AlertCircle className="h-3.5 w-3.5 text-danger shrink-0" />
            <span className="text-xs text-muted">Connection failed — could not reach the server.</span>
            <Button size="xs" variant="outline" onClick={refresh} className="ml-auto">Retry</Button>
          </div>
        )}
      </div>
    </div>
  )
}
