"use client"
/* eslint-disable react-hooks/set-state-in-effect -- data-load + live-poll effects set state after async fetch */

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Play, RotateCcw, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useApi } from "@/hooks/use-api"
import { PageHeader } from "@/components/ui/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { ProgressBar } from "@/components/ui/progress-bar"
import { ScoreRing } from "@/components/ui/score-ring"
import { ROUTES } from "@/lib/constants"
import type { MinimalJob } from "@/lib/types"

interface ScreeningStatus {
  queueState: string;
  screened: number;
  passed: number;
  failed: number;
  overridden: number;
  pending: number;
  totalCandidates: number;
  lastUpdated: string | null;
}

interface ScreeningRow extends Record<string, unknown> {
  candidate_id: string;
  overall: number;
  semantic_score: number;
  skills_score: number;
  experience_score: number;
  education_score: number;
  ai_overall: number;
  ai_status: string;
  status: string;
  matched_skills: string[];
  missing_skills: string[];
  explanation: string;
  recruiter_override: boolean;
  override_reason: string;
  candidates?: { id: string; full_name: string; email: string } | null;
}

function statusVariant(status: string): "success" | "warning" | "destructive" | "secondary" {
  if (status === "passed") return "success";
  if (status === "failed") return "destructive";
  if (status === "overridden") return "warning";
  return "secondary";
}

function queueLabel(state: string): string {
  if (state === "active" || state === "waiting" || state === "delayed" || state === "prioritized") return "Running";
  if (state === "completed") return "Completed";
  if (state === "failed") return "Failed";
  if (state === "none") return "Not run yet";
  return state;
}

export default function JobScreeningPage() {
  const params = useParams<{ id: string }>();
  const jobId = Array.isArray(params.id) ? params.id[0] : params.id;
  const api = useApi();

  const [job, setJob] = useState<MinimalJob | null>(null);
  const [status, setStatus] = useState<ScreeningStatus | null>(null);
  const [rows, setRows] = useState<ScreeningRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [acting, setActing] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [jobsRes, statusRes, resultsRes] = await Promise.all([
        api.listJobs(),
        api.getScreeningStatus(jobId),
        api.listScreeningResults(jobId),
      ]);
      if (jobsRes.success && jobsRes.data) {
        setJob((jobsRes.data as MinimalJob[]).find((j) => j.id === jobId) || null);
      }
      if (statusRes.success && statusRes.data) setStatus(statusRes.data as ScreeningStatus);
      if (resultsRes.success && resultsRes.data) setRows(resultsRes.data as ScreeningRow[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load screening data.");
    } finally {
      setLoading(false);
    }
  }, [api, jobId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Poll while a bulk run is live (progress state, req 13).
  const queueState = status?.queueState;
  useEffect(() => {
    const live = queueState && ["active", "waiting", "delayed", "prioritized"].includes(queueState);
    if (!live) return;
    const id = setInterval(loadAll, 5000);
    return () => clearInterval(id);
  }, [queueState, loadAll]);

  async function handleRun() {
    setRunning(true);
    try {
      const res = await api.runScreening(jobId);
      if (res.success) {
        toast.success(
          (res.data as { deduplicated?: boolean })?.deduplicated
            ? "Screening already running — showing live progress"
            : "Screening queued — progress updates live",
        );
        await loadAll();
      } else {
        toast.error(res.error || "Failed to start screening");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start screening");
    } finally {
      setRunning(false);
    }
  }

  async function handleOverride(candidateId: string, advance: boolean) {
    setActing(candidateId);
    try {
      const res = await api.overrideScreening(jobId, candidateId, advance, reason);
      if (res.success) {
        toast.success(
          advance
            ? "Candidate marked Assessment-eligible. Send the invite from Assessments when ready — no email was sent."
            : "Candidate rejected with audit trail.",
        );
        setExpanded(null);
        setReason("");
        await loadAll();
      } else {
        toast.error(res.error || "Override failed");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Override failed");
    } finally {
      setActing(null);
    }
  }

  const isLive = status ? ["active", "waiting", "delayed", "prioritized"].includes(status.queueState) : false;
  const isFailed = status?.queueState === "failed";
  const progressPct =
    status && status.totalCandidates > 0 ? Math.round((status.screened / status.totalCandidates) * 100) : 0;

  return (
    <div className="pt-6 space-y-6">
      <Link href={ROUTES.jobs}>
        <span className="mb-1 inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Jobs
        </span>
      </Link>
      <PageHeader
        title={job ? `Screening — ${job.title}` : "Screening"}
        description="RAG screening reuses the existing JD parse, embedding, Qdrant and ranking pipeline. Passing marks candidates Assessment-eligible; invites stay recruiter-controlled."
        actions={
          <div className="flex gap-2">
            {isFailed ? (
              <Button size="sm" variant="outline" onClick={handleRun} disabled={running}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Retry screening
              </Button>
            ) : null}
            <Button size="sm" onClick={handleRun} disabled={running || isLive}>
              {running || isLive ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5 mr-1" />
              )}
              {isLive ? "Screening running…" : status?.screened ? "Re-run screening" : "Run screening"}
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-6 text-center">
          <p role="alert" className="text-sm text-red-600">{error}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => { setLoading(true); loadAll(); }}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Retry
          </Button>
        </div>
      ) : (
        <>
          <section className="rounded-xl border border-border bg-surface p-4" aria-live="polite">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={isLive ? "secondary" : isFailed ? "destructive" : "success"}>
                {queueLabel(status?.queueState || "none")}
              </Badge>
              <span className="text-xs text-muted-foreground tabular-nums">
                {status?.screened || 0} / {status?.totalCandidates || 0} screened
                {status?.lastUpdated ? ` · updated ${new Date(status.lastUpdated).toLocaleString()}` : ""}
              </span>
              <span className="ml-auto flex gap-3 text-xs tabular-nums">
                <span className="text-emerald-600">✓ {status?.passed || 0} passed</span>
                <span className="text-red-600">✗ {status?.failed || 0} failed</span>
                <span className="text-amber-600">◐ {status?.overridden || 0} overridden</span>
              </span>
            </div>
            <div className="mt-3">
              <ProgressBar value={progressPct} />
            </div>
            {isFailed ? (
              <p className="mt-2 text-xs text-red-600">
                The bulk job failed (partial results preserved). Retry re-queues safely — completed work is not duplicated.
              </p>
            ) : null}
          </section>

          <section className="rounded-xl border border-border bg-surface overflow-hidden">
            {rows.length === 0 ? (
              <EmptyState
                icon={Play}
                title={status?.totalCandidates ? "No screening results yet" : "No candidates in scope"}
                description={
                  status?.totalCandidates
                    ? "Run screening to score candidates with the RAG pipeline."
                    : "This job has no recruiter-owned candidates to screen yet."
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {rows.map((row) => {
                  const name = row.candidates?.full_name || "Candidate";
                  const open = expanded === row.candidate_id;
                  return (
                    <li key={row.candidate_id} className="p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <ScoreRing value={Math.max(0, Math.min(1, row.overall / 100))} size={44} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={ROUTES.candidateDetail(row.candidate_id)}
                              className="truncate text-sm font-medium hover:underline"
                            >
                              {name}
                            </Link>
                            <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                            {row.recruiter_override ? (
                              <span className="text-[11px] text-muted-foreground" title={row.override_reason}>
                                override: {row.override_reason.slice(0, 60)}
                              </span>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">AI: {row.ai_status}</span>
                            )}
                          </div>
                          <div className="mt-1.5 grid max-w-xl grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-muted-foreground tabular-nums md:grid-cols-4">
                            <span>Semantic {Math.round(row.semantic_score)}%</span>
                            <span>Skills {Math.round(row.skills_score)}%</span>
                            <span>Exp {Math.round(row.experience_score)}%</span>
                            <span>Edu {Math.round(row.education_score)}%</span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setExpanded(open ? null : row.candidate_id); setReason(""); }}
                        >
                          {open ? "Close" : "Review"}
                        </Button>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(row.matched_skills || []).slice(0, 8).map((s) => (
                          <span key={`m-${s}`} className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-700 dark:text-emerald-300">
                            ✓ {s}
                          </span>
                        ))}
                        {(row.missing_skills || []).slice(0, 8).map((s) => (
                          <span key={`x-${s}`} className="rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] text-red-600 dark:text-red-400">
                            ✗ {s}
                          </span>
                        ))}
                      </div>
                      {row.explanation ? (
                        <p className="mt-2 max-w-3xl text-xs text-muted-foreground">{row.explanation}</p>
                      ) : null}

                      {open ? (
                        <div className="mt-3 rounded-lg border border-border p-3">
                          <label className="text-xs font-medium" htmlFor={`reason-${row.candidate_id}`}>
                            Override reason (kept in audit trail; AI result preserved)
                          </label>
                          <textarea
                            id={`reason-${row.candidate_id}`}
                            rows={2}
                            className="mt-1 w-full rounded-md border border-border bg-transparent p-2 text-sm"
                            placeholder="e.g. Strong relevant experience despite score"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                          />
                          <div className="mt-2 flex gap-2">
                            <Button
                              size="sm"
                              disabled={acting === row.candidate_id}
                              onClick={() => handleOverride(row.candidate_id, true)}
                            >
                              Advance to Assessment-eligible
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={acting === row.candidate_id}
                              onClick={() => handleOverride(row.candidate_id, false)}
                            >
                              Reject
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
