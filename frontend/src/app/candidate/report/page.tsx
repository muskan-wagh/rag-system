"use client"

import { useEffect, useState } from "react"
import { candidateApi } from "@/lib/candidate-api"
import { API_BASE } from "@/lib/constants"

/**
 * Candidate portal — My Report (candidate-safe ONLY).
 * Server enforces candidate type; this page never requests internals.
 */
export default function CandidateReportPage() {
  const [report, setReport] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    candidateApi
      .getMyReport()
      .then((r) => setReport(r as unknown as Record<string, unknown>))
      .catch((e) => setError(e instanceof Error ? e.message : "No report available yet."))
  }, [])

  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-xl font-semibold">My Report</h1>
        <p role="alert" className="mt-2 text-sm text-muted-foreground">{error}</p>
      </main>
    )
  }
  if (!report) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-sm text-muted-foreground">Loading your report…</p>
      </main>
    )
  }

  const payload = (report.payload || report) as Record<string, unknown>
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <h1 className="text-xl font-semibold">My Hiring Report</h1>
      <p className="text-xs text-muted-foreground">
        Version {String(report.version || "")} · Generated {String(report.generated_at || "").slice(0, 16).replace("T", " ")}
      </p>
      <pre className="overflow-auto rounded-xl border border-border p-4 text-xs">
        {JSON.stringify(payload, null, 2).slice(0, 8000)}
      </pre>
      <a
        href={`${API_BASE}/candidate/report/download`}
        className="inline-block rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
      >
        Download PDF
      </a>
      <p className="text-[11px] text-muted-foreground">Candidate-safe copy only — no internal notes or confidential details.</p>
    </main>
  )
}
