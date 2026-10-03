"use client"

import { useEffect, useState } from "react"
import { useApi } from "@/hooks/use-api"
import { toast } from "sonner"

/**
 * Recruiter report console: generate / download internal + candidate-safe /
 * send / resend / regenerate. Shows version, last generated, email status.
 * Download uses the auth-fetch blob path (no predictable public URLs).
 */
export function ReportsCard({ candidateId }: { candidateId: string }) {
  const api = useApi()
  const [reports, setReports] = useState<Array<Record<string, unknown>>>([])
  const [busy, setBusy] = useState(false)
  const [decision, setDecision] = useState("Hired")

  async function refresh() {
    const res = await api.listReports(candidateId)
    if (res.success && Array.isArray(res.data)) setReports(res.data as Array<Record<string, unknown>>)
  }

  useEffect(() => {
    refresh().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- per candidate
  }, [candidateId])

  async function generate(reportType: "internal" | "candidate", sendEmail: boolean) {
    setBusy(true)
    try {
      const res = await api.generateReport(candidateId, { reportType, sendEmail })
      if (res.success) {
        toast.success(`${reportType} report generated (v${(res.data as { version: number }).version})`)
        await refresh()
      } else toast.error(res.error || "Generate failed")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generate failed")
    } finally {
      setBusy(false)
    }
  }

  async function download(reportId: string) {
    try {
      // Authenticated blob download — server checks recruiter/job/candidate ownership.
      const blob = await api.downloadReport(candidateId, reportId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `HireStack-Report-${reportId.slice(0, 8)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed")
    }
  }

  async function send(reportId: string, resend: boolean) {
    setBusy(true)
    try {
      const res = await api.sendReport(candidateId, reportId, resend)
      if (res.success) {
        toast.success(resend ? "Report resent" : "Report queued for delivery")
        await refresh()
      } else toast.error(res.error || "Send failed")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed")
    } finally {
      setBusy(false)
    }
  }

  async function finalDecision() {
    if (!confirm(`Record final decision: ${decision}? This persists immediately; the candidate report + email are queued independently and can never roll it back.`)) return
    setBusy(true)
    try {
      const res = await api.finalDecision(candidateId, { decision, sendEmail: true })
      if (res.success) {
        const rep = (res.data as { report?: { queued?: boolean; error?: string } }).report
        toast.success(rep?.queued ? `Decision saved — report queued` : `Decision saved — report queue pending${rep?.error ? `: ${rep.error}` : ""}`)
        await refresh()
      } else toast.error(res.error || "Decision failed")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Decision failed")
    } finally {
      setBusy(false)
    }
  }

  const latest = (t: string) => reports.find((r) => String(r.report_type) === t)

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-2 text-sm font-medium">Reports</h3>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => void generate("candidate", false)} disabled={busy} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
          Generate report
        </button>
        <button onClick={() => void generate("internal", false)} disabled={busy} className="rounded-md border border-border px-3 py-1.5 text-sm disabled:opacity-50">
          Generate internal
        </button>
        <select aria-label="Final decision" value={decision} onChange={(e) => setDecision(e.target.value)} className="rounded-md border border-border bg-transparent px-2 py-1.5 text-sm">
          <option value="Hired">Hired</option>
          <option value="Rejected">Rejected</option>
          <option value="Hold">Hold</option>
        </select>
        <button onClick={finalDecision} disabled={busy} className="rounded-md border border-border px-3 py-1.5 text-sm disabled:opacity-50">
          Save final decision + auto email
        </button>
      </div>

      {reports.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">No reports yet.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-xs">
          {reports.slice(0, 6).map((r) => (
            <li key={String(r.id)} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border p-2">
              <span className="font-medium">{String(r.report_type)} v{String(r.version)}</span>
              <span className="text-muted-foreground">generated {String(r.generated_at || r.created_at || "").slice(0, 16).replace("T", " ")}</span>
              <span className="text-muted-foreground">email: {String(r.email_status || "pending")}{r.email_sent_at ? ` @ ${String(r.email_sent_at).slice(0, 16).replace("T", " ")}` : ""}</span>
              {r.email_error ? <span className="text-red-600">error: {String(r.email_error).slice(0, 120)}</span> : null}
              <span className="ml-auto flex gap-2">
                <button onClick={() => void download(String(r.id))} className="underline">Download PDF</button>
                {String(r.report_type) === "candidate" ? (
                  <>
                    <button onClick={() => void send(String(r.id), false)} className="underline">Send</button>
                    <button onClick={() => void send(String(r.id), true)} className="underline">Resend</button>
                  </>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
      {latest("candidate") ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Last candidate report: v{String(latest("candidate")?.version)} · {String(latest("candidate")?.generated_at || "").slice(0, 16).replace("T", " ")} · email {String(latest("candidate")?.email_status)}
        </p>
      ) : null}
    </section>
  )
}
