"use client"

import { useEffect, useState } from "react"
import { useApi } from "@/hooks/use-api"
import { HiringProgressTracker } from "@/components/hiring-progress-tracker"
import { InterviewerLiveCoding } from "@/components/interview/interviewer-live-coding"
import { ReportsCard } from "@/components/reports/reports-card"
import { toast } from "sonner"

/**
 * Unified recruiter hiring tab — single candidate profile across
 * screening → assessment → technical → HR → offer.
 * All state from backend (progression service source of truth).
 */
export function HiringTab({ candidateId }: { candidateId: string }) {
  const api = useApi();
  const [progress, setProgress] = useState<{
    stages: Array<{ stage: string; state: "completed" | "current" | "upcoming"; score: number | null; status: string | null }>;
    currentStage: string | null;
    timeline: Array<Record<string, unknown>>;
  } | null>(null);
  const [interviewStage, setInterviewStage] = useState<{ interviews: Array<Record<string, unknown>>; invites: Array<Record<string, unknown>>; evaluations: Array<Record<string, unknown>> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [evalForm, setEvalForm] = useState<Record<string, string>>({});
  const [savingEval, setSavingEval] = useState<string | null>(null);
  const [resched, setResched] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<string | null>(null);
  const [liveFor, setLiveFor] = useState<string | null>(null);

  async function reload() {
    const [p, s] = await Promise.all([api.getHiringProgress(candidateId), api.getInterviewStage(candidateId)]);
    if (p.success && p.data) setProgress(p.data as typeof progress);
    if (s.success && s.data) setInterviewStage(s.data as typeof interviewStage);
  }

  useEffect(() => {
    let alive = true;
    reload()
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once per candidate
  }, [candidateId]);

  async function submitEvaluation(interviewId: string) {
    const rec = evalForm[`${interviewId}:rec`] || "hold";
    setSavingEval(interviewId);
    try {
      const res = await api.submitInterviewEvaluation(interviewId, {
        overallRecommendation: rec,
        summary: evalForm[`${interviewId}:summary`] || "",
        privateNotes: evalForm[`${interviewId}:notes`] || "",
        interviewerName: evalForm[`${interviewId}:name`] || "",
      });
      if (res.success) {
        toast.success("Evaluation saved — progression queued");
        await reload();
      } else {
        toast.error(res.error || "Failed to save evaluation");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save evaluation");
    } finally {
      setSavingEval(null);
    }
  }

  async function doReschedule(interviewId: string) {
    setActing(interviewId);
    try {
      const res = await api.rescheduleStageInterview(interviewId, {
        scheduledDate: resched[`${interviewId}:date`] || undefined,
        scheduledTime: resched[`${interviewId}:time`] || undefined,
        meetingLink: resched[`${interviewId}:link`] ?? undefined,
        interviewerName: resched[`${interviewId}:who`] || undefined,
      });
      if (res.success) {
        toast.success("Rescheduled — updated invite emailed automatically");
        await reload();
      } else toast.error(res.error || "Reschedule failed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reschedule failed");
    } finally {
      setActing(null);
    }
  }

  async function doAction(interviewId: string, kind: "cancel" | "resend" | "status", status?: string) {
    setActing(interviewId);
    try {
      const res =
        kind === "cancel"
          ? await api.cancelInterview(interviewId)
          : kind === "resend"
            ? await api.resendInterviewInvite(interviewId)
            : await api.updateInterviewStatus(interviewId, status || "in_progress");
      if (res.success) {
        toast.success(kind === "cancel" ? "Interview cancelled" : kind === "resend" ? "Invite re-sent" : `Status → ${status}`);
        await reload();
      } else toast.error(res.error || "Action failed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActing(null);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading hiring progress…</p>;

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-surface p-4">
        <h3 className="mb-2 text-sm font-medium">Hiring progress</h3>
        {progress ? (
          <HiringProgressTracker stages={progress.stages} variant="recruiter" />
        ) : (
          <p className="text-sm text-muted-foreground">Progress unavailable.</p>
        )}
        {progress?.currentStage ? (
          <p className="mt-2 text-xs text-muted-foreground">Current stage: {progress.currentStage}</p>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h3 className="mb-2 text-sm font-medium">Technical / HR interviews</h3>
        {!interviewStage || interviewStage.interviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">No interviews yet. Schedule from the header or assessment flow.</p>
        ) : (
          <ul className="space-y-4">
            {interviewStage.interviews.map((iv) => {
              const id = String(iv.id);
              const ev = (interviewStage.evaluations || []).find((e) => String(e.interview_id) === id) as Record<string, unknown> | undefined;
              const invite = (interviewStage.invites || []).find((x) => String(x.interview_id) === id) as Record<string, unknown> | undefined;
              return (
                <li key={id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{String(iv.scheduled_date || "")} {String(iv.scheduled_time || "")}</span>
                    <span>{String(iv.interviewer_name || "Unassigned interviewer")}</span>
                    <span>Status: {String(iv.status || "")}</span>
                    {invite ? <span>Invite v{String(invite.version || 1)} · {String(invite.status || "")}</span> : null}
                    {iv.meeting_link ? (
                      <a href={String(iv.meeting_link)} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                        Meeting link
                      </a>
                    ) : null}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <button onClick={() => void doAction(id, "status", "in_progress")} disabled={acting === id} className="rounded-md border border-border px-2 py-1 disabled:opacity-50">
                      Start
                    </button>
                    <button onClick={() => void doAction(id, "status", "no_show")} disabled={acting === id} className="rounded-md border border-border px-2 py-1 disabled:opacity-50">
                      No-show
                    </button>
                    <button onClick={() => void doAction(id, "resend")} disabled={acting === id} className="rounded-md border border-border px-2 py-1 disabled:opacity-50">
                      Re-send invite
                    </button>
                    <button onClick={() => void doAction(id, "cancel")} disabled={acting === id} className="rounded-md border border-red-300 px-2 py-1 text-red-600 disabled:opacity-50">
                      Cancel
                    </button>
                    <button onClick={() => setLiveFor((cur) => (cur === id ? null : id))} className="rounded-md border border-border px-2 py-1">
                      {liveFor === id ? "Hide live coding" : "Live coding"}
                    </button>
                  </div>

                  <div className="mt-2 grid gap-2 md:grid-cols-4">
                    <input
                      aria-label="Reschedule date"
                      type="date"
                      className="rounded-md border border-border bg-transparent px-2 py-1.5 text-sm"
                      value={resched[`${id}:date`] || ""}
                      onChange={(e) => setResched((p) => ({ ...p, [`${id}:date`]: e.target.value }))}
                    />
                    <input
                      aria-label="Reschedule time"
                      type="time"
                      className="rounded-md border border-border bg-transparent px-2 py-1.5 text-sm"
                      value={resched[`${id}:time`] || ""}
                      onChange={(e) => setResched((p) => ({ ...p, [`${id}:time`]: e.target.value }))}
                    />
                    <input
                      aria-label="Meeting link"
                      placeholder="Meeting link"
                      className="rounded-md border border-border bg-transparent px-2 py-1.5 text-sm"
                      value={resched[`${id}:link`] || ""}
                      onChange={(e) => setResched((p) => ({ ...p, [`${id}:link`]: e.target.value }))}
                    />
                    <button onClick={() => void doReschedule(id)} disabled={acting === id} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
                      Reschedule + email
                    </button>
                  </div>

                  {liveFor === id ? (
                    <div className="mt-2">
                      <InterviewerLiveCoding interviewId={id} />
                    </div>
                  ) : null}

                  {ev ? (
                    <p className="mt-2 text-xs">
                      Evaluation: <strong>{String(ev.overall_recommendation || "")}</strong>
                      {ev.summary ? ` — ${String(ev.summary).slice(0, 200)}` : ""}
                      <span className="text-muted-foreground"> (private notes hidden from candidate)</span>
                    </p>
                  ) : (
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <input
                        placeholder="Interviewer name"
                        className="rounded-md border border-border bg-transparent px-2 py-1.5 text-sm"
                        value={evalForm[`${id}:name`] || ""}
                        onChange={(e) => setEvalForm((p) => ({ ...p, [`${id}:name`]: e.target.value }))}
                      />
                      <select
                        aria-label="Recommendation"
                        className="rounded-md border border-border bg-transparent px-2 py-1.5 text-sm"
                        value={evalForm[`${id}:rec`] || "hold"}
                        onChange={(e) => setEvalForm((p) => ({ ...p, [`${id}:rec`]: e.target.value }))}
                      >
                        <option value="strong_hire">Strong hire</option>
                        <option value="hire">Hire</option>
                        <option value="hold">Hold</option>
                        <option value="no_hire">No hire</option>
                        <option value="strong_no_hire">Strong no hire</option>
                      </select>
                      <input
                        placeholder="Summary (visible internally)"
                        className="rounded-md border border-border bg-transparent px-2 py-1.5 text-sm md:col-span-2"
                        value={evalForm[`${id}:summary`] || ""}
                        onChange={(e) => setEvalForm((p) => ({ ...p, [`${id}:summary`]: e.target.value }))}
                      />
                      <textarea
                        placeholder="Private notes (never shown to candidate)"
                        rows={2}
                        className="rounded-md border border-border bg-transparent px-2 py-1.5 text-sm md:col-span-2"
                        value={evalForm[`${id}:notes`] || ""}
                        onChange={(e) => setEvalForm((p) => ({ ...p, [`${id}:notes`]: e.target.value }))}
                      />
                      <button
                        onClick={() => submitEvaluation(id)}
                        disabled={savingEval === id}
                        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 md:col-span-2"
                      >
                        {savingEval === id ? "Saving…" : "Submit evaluation"}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ReportsCard candidateId={candidateId} />

      <section className="rounded-xl border border-border bg-surface p-4">
        <h3 className="mb-2 text-sm font-medium">Stage transition history</h3>
        {!progress || progress.timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transitions recorded yet.</p>
        ) : (
          <ol className="space-y-1.5 text-xs">
            {progress.timeline.map((t, i) => (
              <li key={String(t.id || i)} className="flex gap-2">
                <span className="tabular-nums text-muted-foreground">{String(t.changed_at || "").slice(0, 16).replace("T", " ")}</span>
                <span className="font-medium">{String(t.status || "")}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
