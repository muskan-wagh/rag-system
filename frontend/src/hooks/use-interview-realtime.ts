"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Interview-scoped realtime listener over the EXISTING /ws infrastructure.
 * Server is the source of truth: this hook only LISTENS for
 * `interview:coding` / `interview:updated` broadcasts and asks the caller
 * to refetch via REST. Client messages are ping-only; no writes over WS.
 * Handles reconnect with backoff, duplicate suppression via version compare
 * (done by caller), and auth failure (401 close).
 */
export function useInterviewRealtime(opts: {
  interviewId: string | null
  query: string // e.g. `role=recruiter&token=...` or `session=...` (candidate cookie auto-sent too)
  onCodingEvent: (payload: Record<string, unknown>) => void
  onInterviewUpdated?: (payload: Record<string, unknown>) => void
  enabled?: boolean
}) {
  const { interviewId, query, onCodingEvent, onInterviewUpdated, enabled } = opts
  const [connected, setConnected] = useState(false)
  const [unauthorized, setUnauthorized] = useState(false)
  const cbRef = useRef({ onCodingEvent, onInterviewUpdated })
  cbRef.current = { onCodingEvent, onInterviewUpdated }

  useEffect(() => {
    if (enabled === false || !interviewId) return
    let ws: WebSocket | null = null
    let closed = false
    let attempt = 0
    let timer: ReturnType<typeof setTimeout> | null = null

    const base = (process.env.NEXT_PUBLIC_API_WS_URL || "").trim()
    const url = base
      ? `${base.replace(/\/+$/, "")}/ws?interviewId=${encodeURIComponent(interviewId)}&${query}`
      : (() => {
          const proto = window.location.protocol === "https:" ? "wss" : "ws"
          // Same-origin dev proxy won't have WS; fall back to direct API host from REST base.
          return `${proto}://${window.location.hostname}:5000/ws?interviewId=${encodeURIComponent(interviewId)}&${query}`
        })()

    function connect() {
      if (closed) return
      try {
        ws = new WebSocket(url)
      } catch {
        schedule()
        return
      }
      ws.onopen = () => {
        attempt = 0
        setConnected(true)
      }
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as { event?: string; payload?: Record<string, unknown> }
          if (msg.event === "interview:coding") cbRef.current.onCodingEvent(msg.payload || {})
          else if (msg.event === "interview:updated") cbRef.current.onInterviewUpdated?.(msg.payload || {})
          else if (msg.event === "ws:unauthorized") setUnauthorized(true)
        } catch {
          // ignore malformed
        }
      }
      ws.onclose = () => {
        setConnected(false)
        if (!closed) schedule()
      }
      ws.onerror = () => {
        try { ws?.close() } catch { /* noop */ }
      }
    }

    function schedule() {
      if (closed) return
      attempt += 1
      const delay = Math.min(1000 * 2 ** Math.min(attempt, 5), 15000)
      timer = setTimeout(connect, delay)
    }

    connect()
    const ping = setInterval(() => {
      try { ws?.send(JSON.stringify({ type: "ping" })) } catch { /* noop */ }
    }, 25000)
    return () => {
      closed = true
      if (timer) clearTimeout(timer)
      clearInterval(ping)
      try { ws?.close() } catch { /* noop */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reconnect only on interview/auth change
  }, [interviewId, query, enabled === false ? "off" : "on"])

  return { connected, unauthorized }
}
