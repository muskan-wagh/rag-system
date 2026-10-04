"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  type AudioTrack,
  type Track as TrackType,
  type VideoTrack,
} from "livekit-client"

/**
 * LiveKit video/audio room — the ONLY video layer in HireStack.
 * Live coding stays on the existing /ws + REST stack; this component never
 * touches Monaco, code execution, or interview status (parent owns those).
 */

export interface VideoConnection {
  url: string
  token: string
}

interface TileEntry {
  key: string
  identity: string
  name: string
  isLocal: boolean
  videoTrack?: VideoTrack
  audioTrack?: AudioTrack
  videoMuted: boolean
  audioMuted: boolean
}

type ConnStatus = "connecting" | "connected" | "reconnecting" | "failed" | "left"

function AttachMedia({ track, muted }: { track: TrackType; muted: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    const el = track.kind === Track.Kind.Video ? videoRef.current : audioRef.current
    if (!el) return
    track.attach(el)
    return () => {
      track.detach(el)
    }
  }, [track])
  if (track.kind === Track.Kind.Video) {
    return <video ref={videoRef} autoPlay playsInline muted={muted} className="h-full w-full object-cover" />
  }
  return <audio ref={audioRef} autoPlay className="hidden" />
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase()
}

export function VideoRoom({
  connection,
  localLabel,
  remoteLabel,
  startWith,
  onLeave,
  onRejoin,
  onDeviceToggle,
}: {
  connection: VideoConnection
  localLabel: string
  remoteLabel: string
  startWith?: { camera: boolean; mic: boolean }
  onLeave: () => void
  onRejoin?: () => void
  /** Neutral observable signal (camera/mic toggles). Never a verdict. */
  onDeviceToggle?: (device: "camera" | "mic", enabled: boolean) => void
}) {
  const [status, setStatus] = useState<ConnStatus>("connecting")
  const [error, setError] = useState<string | null>(null)
  const [tiles, setTiles] = useState<TileEntry[]>([])
  const [camOn, setCamOn] = useState(startWith?.camera !== false)
  const [micOn, setMicOn] = useState(startWith?.mic !== false)
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([])
  const roomRef = useRef<Room | null>(null)
  const leftIntentionally = useRef(false)
  // Join-time device preferences only — captured once per connection.
  const startRef = useRef(startWith)

  const syncTiles = useCallback((room: Room) => {
    const entries: TileEntry[] = []
    const lp = room.localParticipant
    const camPub = lp.getTrackPublication(Track.Source.Camera)
    const micPub = lp.getTrackPublication(Track.Source.Microphone)
    entries.push({
      key: `local-${lp.identity}`,
      identity: lp.identity,
      name: localLabel,
      isLocal: true,
      videoTrack: (camPub?.videoTrack ?? undefined) as VideoTrack | undefined,
      audioTrack: (micPub?.audioTrack ?? undefined) as AudioTrack | undefined,
      videoMuted: camPub?.isMuted ?? true,
      audioMuted: micPub?.isMuted ?? true,
    })
    for (const [, p] of room.remoteParticipants) {
      let videoTrack: VideoTrack | undefined
      let audioTrack: AudioTrack | undefined
      let videoMuted = true
      let audioMuted = true
      for (const [, pub] of p.trackPublications) {
        if (pub.source === Track.Source.Camera && pub.videoTrack) {
          videoTrack = pub.videoTrack as VideoTrack
          videoMuted = pub.isMuted
        }
        if (pub.source === Track.Source.Microphone && pub.audioTrack) {
          audioTrack = pub.audioTrack as AudioTrack
          audioMuted = pub.isMuted
        }
      }
      entries.push({
        key: `remote-${p.identity}`,
        identity: p.identity,
        name: p.name || remoteLabel,
        isLocal: false,
        videoTrack,
        audioTrack,
        videoMuted,
        audioMuted,
      })
    }
    setTiles(entries)
  }, [localLabel, remoteLabel])

  useEffect(() => {
    let cancelled = false
    const room = new Room({ adaptiveStream: true, dynacast: true })
    roomRef.current = room
    const resync = () => {
      if (!cancelled) syncTiles(room)
    }

    room
      .on(RoomEvent.TrackSubscribed, resync)
      .on(RoomEvent.TrackUnsubscribed, resync)
      .on(RoomEvent.TrackMuted, resync)
      .on(RoomEvent.TrackUnmuted, resync)
      .on(RoomEvent.ParticipantConnected, resync)
      .on(RoomEvent.ParticipantDisconnected, resync)
      .on(RoomEvent.LocalTrackPublished, resync)
      .on(RoomEvent.LocalTrackUnpublished, resync)
      .on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        if (cancelled) return
        if (state === ConnectionState.Connected) {
          setStatus("connected")
          setError(null)
        } else if (state === ConnectionState.Reconnecting) {
          setStatus("reconnecting")
        } else if (state === ConnectionState.Disconnected && !leftIntentionally.current) {
          setStatus("failed")
          setError("Connection lost.")
        }
      })

    async function join() {
      try {
        await room.connect(connection.url, connection.token)
        if (cancelled) {
          await room.disconnect()
          return
        }
        // Publish local devices (each guarded — denial disables that device only).
        const wantCam = startRef.current?.camera !== false
        const wantMic = startRef.current?.mic !== false
        try {
          await room.localParticipant.setCameraEnabled(wantCam)
        } catch {
          setCamOn(false)
          setError((e) => e || "Camera is blocked — you can still participate with audio.")
        }
        try {
          await room.localParticipant.setMicrophoneEnabled(wantMic)
        } catch {
          setMicOn(false)
          setError((e) => e || "Microphone is blocked — check browser permissions.")
        }
        const pubs = room.localParticipant.getTrackPublications()
        for (const pub of pubs) {
          if (pub.source === Track.Source.Camera) setCamOn(!pub.isMuted)
          if (pub.source === Track.Source.Microphone) setMicOn(!pub.isMuted)
        }
        resync()
        try {
          const outputs = await Room.getLocalDevices("audiooutput")
          if (!cancelled) setAudioOutputs(outputs)
        } catch {
          // output selection unsupported (e.g. Safari) — hide the selector
        }
      } catch (e) {
        if (!cancelled) {
          setStatus("failed")
          setError(e instanceof Error ? e.message : "Could not join video.")
        }
      }
    }
    void join()

    return () => {
      cancelled = true
      leftIntentionally.current = true
      void room.disconnect().catch(() => {})
      roomRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- connect once per token
  }, [connection.url, connection.token])

  async function toggleCamera() {
    const room = roomRef.current
    if (!room) return
    const next = !camOn
    try {
      await room.localParticipant.setCameraEnabled(next)
      setCamOn(next)
      onDeviceToggle?.("camera", next)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not toggle camera.")
    }
  }

  async function toggleMic() {
    const room = roomRef.current
    if (!room) return
    const next = !micOn
    try {
      await room.localParticipant.setMicrophoneEnabled(next)
      setMicOn(next)
      onDeviceToggle?.("mic", next)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not toggle microphone.")
    }
  }

  async function switchSpeaker(deviceId: string) {
    const room = roomRef.current
    if (!room || !deviceId) return
    try {
      await room.switchActiveDevice("audiooutput", deviceId)
    } catch {
      setError("Audio output switching is not supported in this browser.")
    }
  }

  function leave() {
    leftIntentionally.current = true
    setStatus("left")
    const room = roomRef.current
    roomRef.current = null
    if (room) void room.disconnect().catch(() => {})
    onLeave()
  }

  const remoteCount = tiles.filter((t) => !t.isLocal).length

  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Video interview</p>
        <span className="text-xs text-muted-foreground" role="status">
          {status === "connected" && (remoteCount > 0 ? `${remoteCount} other participant${remoteCount > 1 ? "s" : ""} connected` : "Waiting for the other participant…")}
          {status === "connecting" && "Connecting…"}
          {status === "reconnecting" && "Reconnecting…"}
          {status === "failed" && "Connection issue"}
          {status === "left" && "You left the video call"}
        </span>
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-700">{error}</p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        {tiles.map((t) => (
          <div key={t.key} className="relative aspect-video overflow-hidden rounded-lg bg-black/85">
            {t.videoTrack && !t.videoMuted ? (
              <AttachMedia track={t.videoTrack} muted={t.isLocal} />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-lg font-semibold text-white">
                  {initials(t.name)}
                </span>
              </div>
            )}
            {t.audioTrack && !t.isLocal ? <AttachMedia track={t.audioTrack} muted={false} /> : null}
            <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">
              {t.name}{t.isLocal ? " (you)" : ""}
              {t.videoMuted ? " · camera off" : ""}{!t.isLocal && t.audioMuted ? " · muted" : ""}
            </span>
          </div>
        ))}
        {tiles.length === 0 ? (
          <div className="flex aspect-video items-center justify-center rounded-lg bg-black/85 text-xs text-white/70 sm:col-span-2">
            {status === "failed" ? "Video unavailable" : "Joining video…"}
          </div>
        ) : null}
      </div>

      {(status === "connected" || status === "reconnecting") ? (
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={toggleCamera} className="rounded-md border border-border px-3 py-1.5 text-xs" aria-pressed={camOn}>
            {camOn ? "Camera off" : "Camera on"}
          </button>
          <button onClick={toggleMic} className="rounded-md border border-border px-3 py-1.5 text-xs" aria-pressed={micOn}>
            {micOn ? "Mute" : "Unmute"}
          </button>
          {audioOutputs.length > 0 ? (
            <select
              aria-label="Speaker"
              className="rounded-md border border-border bg-transparent px-2 py-1.5 text-xs"
              defaultValue=""
              onChange={(e) => void switchSpeaker(e.target.value)}
            >
              <option value="">Speaker: default</option>
              {audioOutputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || "Speaker"}</option>
              ))}
            </select>
          ) : null}
          <button onClick={leave} className="rounded-md border border-red-300 px-3 py-1.5 text-xs text-red-600">
            Leave video
          </button>
        </div>
      ) : null}

      {status === "failed" ? (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => (onRejoin ? onRejoin() : onLeave())} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
            Rejoin video
          </button>
          <button onClick={leave} className="rounded-md border border-border px-3 py-1.5 text-xs">
            Continue without video
          </button>
        </div>
      ) : null}
    </div>
  )
}
