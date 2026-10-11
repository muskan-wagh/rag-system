"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { candidateApi } from "@/lib/candidate-api"
import { CodingEditor } from "@/components/assessment-take/coding-editor"
import { HiringProgressTracker } from "@/components/hiring-progress-tracker"
import { VideoRoom, type VideoConnection } from "@/components/interview/video-room"
import { useInterviewRealtime } from "@/hooks/use-interview-realtime"

/**
 * Secure interview waiting room + LiveKit video + SHARED live coding workspace.
 * Video is the ONLY LiveKit surface; coding/sync stay on the existing
 * /ws + REST stack. No private notes / evaluations / hidden scores here.
 * Camera/mic-off is logged as a neutral observable signal — never a verdict.
 */

type VideoPhase = "idle" | "preview" | "live" | "unavailable"
type PermState = "unknown" | "granted" | "denied" | "unavailable"

export function InterviewJoinView({ token, expectedStage }: { token: string; expectedStage: string }) {
  const [info, setInfo] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [coding, setCoding] = useState<Record<string, unknown> | null>(null)
  const [code, setCode] = useState("// Loading shared workspace…\n")
  const [running, setRunning] = useState(false)
  const [stages, setStages] = useState<Array<{ stage: string; state: "completed" | "current" | "upcoming" }>>([])
  const versionRef = useRef(0)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Video state
  const [videoPhase, setVideoPhase] = useState<VideoPhase>("idle")
  const [videoConn, setVideoConn] = useState<VideoConnection | null>(null)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [camPerm, setCamPerm] = useState<PermState>("unknown")
  const [micPerm, setMicPerm] = useState<PermState>("unknown")
  const [startCam, setStartCam] = useState(true)
  const [startMic, setStartMic] = useState(true)
  const [joining, setJoining] = useState(false)
  const previewVideoRef = useRef<HTMLVideoElement>(null)
  const previewStreamRef = useRef<MediaStream | null>(null)

  const refreshCoding = useCallback(async () => {
    try {
      const s = await candidateApi.getInterviewCodingSession()
      setCoding(s)
      const v = Number(s.version || 0)
      // Server wins on conflict (interviewer push/reset bumps version).
      if (v >= versionRef.current) {
        versionRef.current = v
        setCode(String(s.candidate_code || ""))
      }
    } catch {
      // workspace unavailable until recruiter pushes a problem — keep scratchpad
    }
  }, [])

  useEffect(() => {
    candidateApi
      .exchangeInterviewToken(token)
      .then((r) => {
        setInfo(r as unknown as Record<string, unknown>)
        void refreshCoding()
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Invalid interview link."))
    candidateApi.getProgress().then((p) => setStages(p.stages as typeof stages)).catch(() => {})
  }, [token, refreshCoding])

  // Polling fallback: WS is progressive enhancement; REST is source of truth.
  useEffect(() => {
    const t = setInterval(() => { void refreshCoding() }, 10000)
    return () => clearInterval(t)
  }, [refreshCoding])

  // Stop preview tracks on unmount.
  useEffect(() => {
    return () => {
      previewStreamRef.current?.getTracks().forEach((t) => t.stop())
      previewStreamRef.current = null
    }
  }, [])

  // Candidate WS auth: cookie session binds the room server-side.
  const interviewKey = String((coding as Record<string, unknown> | null)?.interview_id || "")
  useInterviewRealtime({
    interviewId: interviewKey || null,
    query: "",
    enabled: interviewKey.length > 0,
    onCodingEvent: (p) => {
      const v = Number(p.version || 0)
      if (p.type === "code" && v <= versionRef.current) return // own echo / duplicate
      void refreshCoding()
    },
    onInterviewUpdated: () => {
      candidateApi.getInterview().then((i) => setInfo((prev) => ({ ...(prev || {}), ...(i as object) }))).catch(() => {})
    },
  })

  function onCodeChange(next: string) {
    setCode(next)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await candidateApi.updateInterviewCode(next, versionRef.current)
        versionRef.current = Number(res.version || versionRef.current + 1)
      } catch {
        // stale/ended — refetch truth
        void refreshCoding()
      }
    }, 700)
  }

  async function run() {
    setRunning(true)
    try {
      const out = await candidateApi.runInterviewCode()
      setCoding((prev) => ({ ...(prev || {}), output: out, run_state: "succeeded" }))
    } catch (e) {
      setCoding((prev) => ({ ...(prev || {}), output: { stderr: e instanceof Error ? e.message : "Run failed" }, run_state: "failed" }))
    } finally {
      setRunning(false)
    }
  }

  function stopPreview() {
    previewStreamRef.current?.getTracks().forEach((t) => t.stop())
    previewStreamRef.current = null
    if (previewVideoRef.current) previewVideoRef.current.srcObject = null
  }

  async function checkDevices() {
    setVideoError(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamPerm("unavailable")
      setMicPerm("unavailable")
      setVideoError("This browser does not support camera/microphone access. You can still join with the meeting link below.")
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      stopPreview()
      previewStreamRef.current = stream
      if (previewVideoRef.current) previewVideoRef.current.srcObject = stream
      setCamPerm(stream.getVideoTracks().length > 0 ? "granted" : "unavailable")
      setMicPerm(stream.getAudioTracks().length > 0 ? "granted" : "unavailable")
      setVideoPhase("preview")
    } catch (e) {
      const name = e instanceof DOMException ? e.name : ""
      if (name === "NotAllowedError") {
        setCamPerm("denied")
        setMicPerm("denied")
        setVideoError("Camera/microphone permission was denied. Allow access in the browser address bar to use built-in video — or join with the meeting link below. Denied access is not held against you.")
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setCamPerm("unavailable")
        setMicPerm("unavailable")
        setVideoError("No camera or microphone was found on this device. You can still join with the meeting link below.")
      } else {
        setVideoError(e instanceof Error ? e.message : "Could not access camera/microphone.")
      }
    }
  }

  async function joinVideo() {
    setJoining(true)
    setVideoError(null)
    try {
      const res = await candidateApi.getLivekitToken()
      if (!res.videoEnabled || !res.token || !res.url) {
        stopPreview()
        setVideoPhase("unavailable")
        return
      }
      stopPreview() // LiveKit re-acquires devices on connect
      setVideoConn({ url: String(res.url), token: String(res.token) })
      setVideoPhase("live")
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not join video."
      // Expired/cancelled/ended interviews land here — surface plainly.
      setVideoError(msg)
      setVideoPhase("unavailable")
    } finally {
      setJoining(false)
    }
  }

  function leaveVideo() {
    setVideoConn(null)
    setVideoPhase("preview")
  }

  function reportToggle(device: "camera" | "mic", enabled: boolean) {
    // Neutral observable signal only — never a cheating verdict.
    const type = device === "camera"
      ? enabled ? "camera_enabled" : "camera_disabled"
      : enabled ? "mic_enabled" : "mic_disabled"
    candidateApi.logVideoEvent(type).catch(() => {})
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-xl font-semibold">{expectedStage}</h1>
        <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>
      </main>
    )
  }
  if (!info) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-sm text-muted-foreground">Validating your secure interview link…</p>
      </main>
    )
  }

  const meetingLink = String(info.meeting_link || "")
  const problem = coding?.problem as Record<string, unknown> | null | undefined
  const output = coding?.output as Record<string, unknown> | undefined
  const workspaceStatus = !coding
    ? "Waiting for your interviewer to share a coding problem…"
    : String(coding.session_state || "") === "ended"
      ? "Interview ended — workspace is read-only."
      : `Live workspace · v${String(coding.version ?? "—")} · run: ${String(coding.run_state ?? "idle")}`
  const ended = String(coding?.session_state || "") === "ended"
  const interviewOver = ["completed", "cancelled"].includes(String(info.status || "")) || ended

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <h1 className="text-xl font-semibold">{String(info.stage || expectedStage)}</h1>
      <p className="text-sm text-muted-foreground">
        {String(info.scheduled_date || "")} {String(info.scheduled_time || "")} · {String(info.interview_type || "online")} · Status: {String(info.status || "")}
      </p>

      {stages.length > 0 ? <HiringProgressTracker stages={stages} variant="candidate" /> : null}

      <div className="rounded-xl border border-border p-4">
        <h2 className="mb-2 text-sm font-medium">Waiting room</h2>
        <p className="text-sm text-muted-foreground">
          Your interviewer will join shortly. Check your camera and microphone, then join the video interview below.
        </p>

        {videoPhase === "idle" ? (
          <button onClick={checkDevices} className="mt-3 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
            Check camera &amp; mic
          </button>
        ) : null}

        {videoPhase === "preview" ? (
          <div className="mt-3 space-y-2">
            <div className="aspect-video w-full max-w-md overflow-hidden rounded-lg bg-black/85">
              <video ref={previewVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-border px-2 py-1" role="status">
                Camera: {camPerm === "granted" ? "working" : camPerm}
              </span>
              <span className="rounded-full border border-border px-2 py-1" role="status">
                Microphone: {micPerm === "granted" ? "working" : micPerm}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={startCam} onChange={(e) => setStartCam(e.target.checked)} />
                Start with camera on
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={startMic} onChange={(e) => setStartMic(e.target.checked)} />
                Start with mic on
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={joinVideo}
                disabled={joining || interviewOver}
                className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {joining ? "Joining…" : "Join Interview"}
              </button>
              <button onClick={() => { stopPreview(); setVideoPhase("idle") }} className="rounded-md border border-border px-4 py-2.5 text-sm">
                Recheck devices
              </button>
            </div>
          </div>
        ) : null}

        {videoError ? (
          <p role="alert" className="mt-3 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-800">{videoError}</p>
        ) : null}

        {videoPhase === "live" && videoConn ? (
          <div className="mt-3">
            <VideoRoom
              key={videoConn.token.slice(-12)}
              connection={videoConn}
              localLabel="You"
              remoteLabel="Interviewer"
              startWith={{ camera: startCam, mic: startMic }}
              onLeave={leaveVideo}
              onRejoin={joinVideo}
              onDeviceToggle={reportToggle}
            />
          </div>
        ) : null}

        {videoPhase === "unavailable" || videoPhase === "idle" ? (
          <div className="mt-3">
            {videoPhase === "unavailable" ? (
              <p className="text-xs text-muted-foreground">
                Built-in video is not available for this interview (service not configured or interview not joinable).
                Use the external meeting link to meet your interviewer, then return here for shared coding.
              </p>
            ) : null}
            {meetingLink ? (
              <a
                href={meetingLink}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
              >
                Join meeting
              </a>
            ) : (
              <p className="mt-2 text-sm">Meeting link will appear here once your recruiter adds it.</p>
            )}
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-border p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Shared coding workspace</h2>
          <span className="text-xs text-muted-foreground">{workspaceStatus}</span>
        </div>
        {problem ? (
          <div className="mb-2 text-xs">
            <p className="font-medium">{String(problem.title)}</p>
            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{String(problem.description || "").slice(0, 2000)}</p>
          </div>
        ) : (
          <p className="mb-2 text-xs text-muted-foreground">No coding problem shared yet — your interviewer will push one when ready (JavaScript).</p>
        )}
        <CodingEditor value={code} onChange={onCodeChange} language="javascript" height={300} />
        <div className="mt-2 flex gap-2">
          <button onClick={run} disabled={running || ended} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {running ? "Running…" : "Run code"}
          </button>
          <button onClick={() => void refreshCoding()} className="rounded-md border border-border px-4 py-2 text-sm">
            Sync
          </button>
        </div>
        {output ? (
          <pre className="mt-2 max-h-44 overflow-auto rounded-md bg-black/80 p-2 text-[11px] text-green-200">
            {String(output.stdout || output.stderr || JSON.stringify(output).slice(0, 2000))}
          </pre>
        ) : null}
      </div>
    </main>
  )
}
