"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"

/**
 * In-app video/audio room backed by LiveKit.
 *
 * Media ONLY. The shared live-coding workspace deliberately remains on the
 * existing WebSocket layer — this component does not carry code and does not
 * replace that transport.
 *
 * Tokens are minted server-side and are room-scoped + short-lived; the LiveKit
 * API secret is never present in the browser bundle.
 *
 * If the deployment has no LiveKit credentials the component degrades to the
 * external meeting link instead of breaking the interview.
 */

export type VideoRole = "candidate" | "recruiter"

interface LiveKitCredentials {
  token: string
  url: string
  roomName: string
}

type ConnectionState = "idle" | "connecting" | "connected" | "error" | "unsupported"

export function InterviewVideoRoom({
  role,
  interviewId,
  fallbackUrl,
}: {
  role: VideoRole
  /** Recruiter side only; the candidate endpoint derives its own interview. */
  interviewId?: string
  fallbackUrl?: string
}) {
  const [state, setState] = useState<ConnectionState>("idle")
  const [roomName, setRoomName] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [micEnabled, setMicEnabled] = useState(true)
  const [camEnabled, setCamEnabled] = useState(true)
  const [mediaError, setMediaError] = useState<string | null>(null)

  const roomRef = useRef<LiveKitCredentials | null>(null)
  const clientRef = useRef<{
    connect: (url: string, token: string) => Promise<void>
    disconnect: () => void
    room?: {
      localParticipant?: {
        setMicrophoneEnabled: (v: boolean) => Promise<unknown>
        setCameraEnabled: (v: boolean) => Promise<unknown>
      }
    }
  } | null>(null)

  const fetchCredentials = useCallback(async (): Promise<LiveKitCredentials | null> => {
    const base = process.env.NEXT_PUBLIC_API_URL || ""
    try {
      if (role === "recruiter") {
        if (!interviewId) return null
        const res = await fetch(`${base}/api/interviews/${interviewId}/livekit-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
        if (res.status === 503) return null
        if (!res.ok) throw new Error(`Token request failed (${res.status})`)
        const body = await res.json()
        return body?.data ?? null
      }
      // Candidate: the HttpOnly session cookie authenticates the request.
      const res = await fetch(`${base}/api/candidate/interview/livekit-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      if (res.status === 503) return null
      if (!res.ok) throw new Error(`Token request failed (${res.status})`)
      const body = await res.json()
      return body?.data ?? null
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the video service")
      return null
    }
  }, [role, interviewId])

  const connect = useCallback(async () => {
    setState("connecting")
    setError(null)
    const creds = await fetchCredentials()
    if (!creds) {
      setState("unsupported")
      return
    }
    roomRef.current = creds
    setRoomName(creds.roomName)
    try {
      const { Room, RoomEvent } = await import("livekit-client")
      const room = new Room({ adaptiveStream: true, dynacast: true })
      clientRef.current = room as unknown as typeof clientRef.current

      room.on(RoomEvent.Disconnected, () => setState("idle"))
      room.on(RoomEvent.Reconnecting, () => setState("connecting"))

      await room.connect(creds.url, creds.token)
      setState("connected")
    } catch (err) {
      setState("error")
      setError(err instanceof Error ? err.message : "Video connection failed")
    }
  }, [fetchCredentials])

  const disconnect = useCallback(() => {
    try {
      clientRef.current?.disconnect()
    } catch {
      // Already closed.
    }
    clientRef.current = null
    roomRef.current = null
    setRoomName("")
    setState("idle")
  }, [])

  useEffect(() => disconnect, [disconnect])

  const toggleMic = useCallback(async () => {
    const next = !micEnabled
    setMicEnabled(next)
    try {
      await clientRef.current?.room?.localParticipant?.setMicrophoneEnabled(next)
    } catch (err) {
      setMicEnabled(!next)
      setMediaError(err instanceof Error ? err.message : "Microphone toggle failed")
    }
  }, [micEnabled])

  const toggleCam = useCallback(async () => {
    const next = !camEnabled
    setCamEnabled(next)
    try {
      await clientRef.current?.room?.localParticipant?.setCameraEnabled(next)
    } catch (err) {
      setCamEnabled(!next)
      setMediaError(err instanceof Error ? err.message : "Camera toggle failed")
    }
  }, [camEnabled])

  if (state === "unsupported") {
    return fallbackUrl ? (
      <a
        href={fallbackUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-block rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
      >
        Join meeting
      </a>
    ) : (
      <p className="text-sm text-muted">
        Video isn&apos;t available for this session. Your interviewer will share a meeting link.
      </p>
    )
  }

  if (state === "idle") {
    return (
      <div className="space-y-3">
        <Button onClick={connect} size="sm">
          Join video call
        </Button>
        <p className="text-xs text-muted">
          Your browser will ask for camera and microphone access. Audio and video are used for this
          interview only.
        </p>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* LiveKit attaches its media tracks to the room; this element hosts them. */}
      <div
        data-livekit-room={roomName}
        className="min-h-[180px] w-full rounded-lg border border-border bg-muted/30"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={toggleMic} aria-pressed={!micEnabled}>
          {micEnabled ? "Mute" : "Unmute"}
        </Button>
        <Button variant="outline" size="sm" onClick={toggleCam} aria-pressed={!camEnabled}>
          {camEnabled ? "Stop video" : "Start video"}
        </Button>
        <Button variant="outline" size="sm" onClick={disconnect}>
          Leave
        </Button>
        <span className="text-xs text-muted">
          {state === "connecting" ? "Connecting…" : state === "connected" ? "Connected" : "Reconnecting…"}
        </span>
      </div>
      {mediaError ? <p className="text-xs text-destructive">{mediaError}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}