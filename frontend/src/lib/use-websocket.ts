"use client"

import { useEffect, useRef } from "react"

type EventHandler = (payload: Record<string, unknown>) => void

const listeners = new Map<string, Set<EventHandler>>()

function getWsUrl(): string {
  if (typeof window === "undefined") return ""
  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  if (apiUrl) {
    const host = apiUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "")
    const proto = apiUrl.startsWith("https") ? "wss:" : "ws:"
    return `${proto}//${host}/ws`
  }
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:"
  const host = window.location.host
  if (host === "localhost:3000" || host === "127.0.0.1:3000") {
    return `${proto}//localhost:8080/ws`
  }
  return `${proto}//${host}/ws`
}

let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

function connect() {
  if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) return

  ws = new WebSocket(getWsUrl())

  ws.onmessage = (event) => {
    try {
      const { event: name, payload } = JSON.parse(event.data)
      const handlers = listeners.get(name)
      if (handlers) {
        handlers.forEach((fn) => fn(payload ?? {}))
      }
    } catch {
      // ignore malformed messages
    }
  }

  ws.onclose = () => {
    ws = null
    reconnectTimer = setTimeout(connect, 3000)
  }

  ws.onerror = () => {
    ws?.close()
  }
}

function disconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  if (ws) {
    ws.onclose = null
    ws.close()
    ws = null
  }
}

export function onEvent(event: string, handler: EventHandler): () => void {
  if (!listeners.has(event)) {
    listeners.set(event, new Set())
  }
  listeners.get(event)!.add(handler)
  return () => {
    listeners.get(event)?.delete(handler)
  }
}

export function useWebSocket(event: string, handler: EventHandler) {
  const handlerRef = useRef(handler)

  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  useEffect(() => {
    connect()
    const unsubscribe = onEvent(event, (payload) => handlerRef.current(payload))
    return () => {
      unsubscribe()
      if (listeners.size === 0) disconnect()
    }
  }, [event])
}
