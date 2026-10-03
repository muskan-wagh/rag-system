"use client"

import { useCallback, useEffect, useState } from "react"
import { useApi } from "@/hooks/use-api"
import { useAuth } from "@clerk/nextjs"
import { CodingEditor } from "@/components/assessment-take/coding-editor"
import { useInterviewRealtime } from "@/hooks/use-interview-realtime"
import { toast } from "sonner"

/**
 * Recruiter live-coding console: select/push problem, observe candidate code
 * live (read-only mirror), run candidate code, private notes live in the
 * evaluation form (never broadcast, never visible to candidate), end interview.
 */
export function InterviewerLiveCoding({ interviewId }: { interviewId: string }) {
  const api = useApi()
  const { getToken } = useAuth()
  const [session, setSession] = useState<Record<string, unknown> | null>(null)
  const [problems, setProblems] = useState<Array<Record<string, unknown>>>([])
  const [selected, setSelected] = useState("")
  const [busy, setBusy] = useState(false)
  const [wsQuery, setWsQuery] = useState("")

  const refresh = useCallback(async () => {
    const res = await api.getCodingSession(interviewId)
    if (res.success && res.data) {
      setSession(res.data as Record<string, unknown>)
      return res.data as Record<string, unknown>
    }
    return null
  }, [api, interviewId])

  useEffect(() => {
    refresh()
    api.listInterviewProblems().then((r) => {
      if (r.success && Array.isArray(r.data)) setProblems(r.data as Array<Record<string, unknown>>)
    }).catch(() => {})
    getToken().then((t) => setWsQuery(`role=recruiter&token=${encodeURIComponent(t || "")}`)).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount per interview
  }, [interviewId])

  // Polling fallback keeps the mirror fresh when WS is unavailable.
  useEffect(() => {
    const t = setInterval(() => { void refresh() }, 8000)
    return () => clearInterval(t)
  }, [refresh])

  useInterviewRealtime({
    interviewId,
    query: wsQuery,
    enabled: wsQuery.length > 0,
    onCodingEvent: (p) => {
      const v = Number(p.version || 0)
      const cur = Number((session as Record<string, unknown> | null)?.version || 0)
      if (v > 0 && v <= cur && p.type !== "run_finished") return // duplicate/stale
      void refresh()
    },
  })

  async function push() {
    if (!selected) return
    setBusy(true)
    try {
      const res = await api.pushCodingProblem(interviewId, selected)
      if (res.success) {
        toast.success("Problem pushed to candidate")
        await refresh()
      } else toast.error(res.error || "Push failed")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Push failed")
    } finally {
      setBusy(false)
    }
  }

  async function run() {
    setBusy(true)
    try {
      const res = await api.runCodingSession(interviewId)
      if (res.success) await refresh()
      else toast.error(res.error || "Run failed")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Run failed")
    } finally {
      setBusy(false)
    }
  }

  async function end() {
    if (!confirm("End this interview? The coding workspace will lock.")) return
    setBusy(true)
    try {
      const res = await api.endInterview(interviewId)
      if (res.success) {
        toast.success("Interview ended")
        await refresh()
      } else toast.error(res.error || "End failed")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "End failed")
    } finally {
      setBusy(false)
    }
  }

  const problem = session?.problem as Record<string, unknown> | null | undefined
  const output = session?.output as Record<string, unknown> | undefined
  const ended = String(session?.session_state || "") === "ended"

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Coding problem"
          className="rounded-md border border-border bg-transparent px-2 py-1.5 text-sm"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Select problem…</option>
          {problems.map((p) => (
            <option key={String(p.id)} value={String(p.id)}>{String(p.title)}</option>
          ))}
        </select>
        <button onClick={push} disabled={busy || !selected || ended} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
          Push to candidate
        </button>
        <button onClick={run} disabled={busy || ended} className="rounded-md border border-border px-3 py-1.5 text-sm disabled:opacity-50">
          Run candidate code
        </button>
        <button onClick={() => void refresh()} className="rounded-md border border-border px-3 py-1.5 text-sm">
          Refresh
        </button>
        <button onClick={end} disabled={busy || ended} className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 disabled:opacity-50">
          {ended ? "Ended" : "End interview"}
        </button>
      </div>
      {problem ? (
        <div className="text-xs">
          <p className="font-medium">{String(problem.title)}</p>
          <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{String(problem.description || "").slice(0, 1000)}</p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No problem pushed yet.</p>
      )}
      <CodingEditor value={String(session?.candidate_code || "// waiting for candidate…")} language="javascript" height={240} readOnly />
      <p className="text-[11px] text-muted-foreground">Read-only observer view · version {String(session?.version ?? "—")} · run: {String(session?.run_state ?? "—")}</p>
      {output ? (
        <pre className="max-h-40 overflow-auto rounded-md bg-black/80 p-2 text-[11px] text-green-200">
          {String(output.stdout || output.stderr || JSON.stringify(output).slice(0, 2000))}
        </pre>
      ) : null}
    </div>
  )
}
