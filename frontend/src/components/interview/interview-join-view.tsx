"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { candidateApi } from "@/lib/candidate-api"
import { CodingEditor } from "@/components/assessment-take/coding-editor"
import { HiringProgressTracker } from "@/components/hiring-progress-tracker"
import { useInterviewRealtime } from "@/hooks/use-interview-realtime"

/**
 * Secure interview waiting room + SHARED live coding workspace.
 * Video stays external via meeting_link (provider-agnostic).
 * No private notes / evaluations / hidden scores are ever fetched here.
 * Server (REST + persisted coding session) is the source of truth;
 * WS only triggers refetch. Code edits debounce to REST with version
 * dedupe; refresh/reconnect refetches full state.
 */
export function InterviewJoinView({ token, expectedStage }: { token: string; expectedStage: string }) {
  const [info, setInfo] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [coding, setCoding] = useState<Record<string, unknown> | null>(null)
  const [code, setCode] = useState("// Loading shared workspace…\n")
  const [running, setRunning] = useState(false)
  const [stages, setStages] = useState<Array<{ stage: string; state: "completed" | "current" | "upcoming" }>>([])
  const versionRef = useRef(0)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // Polling fallback: WS is progressive enhancement (cookie-based WS auth
  // can fail cross-site); REST remains the source of truth.
  useEffect(() => {
    const t = setInterval(() => { void refreshCoding() }, 10000)
    return () => clearInterval(t)
  }, [refreshCoding])

  // Candidate WS auth: cookie session binds the room server-side.
  // Interview id unknown until coding fetch; use a stable key from info.
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
          Your interviewer will join shortly. Keep this page open. When it&apos;s time, join via the meeting link below, then return here for shared coding.
        </p>
        {meetingLink ? (
          <a
            href={meetingLink}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Join meeting
          </a>
        ) : (
          <p className="mt-3 text-sm">Meeting link will appear here once your recruiter adds it.</p>
        )}
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
