"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { useSearchParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { Star, Gavel, Loader2, X, PauseCircle, CircleX, Briefcase, Route } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { StageBadge } from "@/components/ui/stage-badge"
import { CandidateJourney } from "@/components/workspace/candidate-journey"
import { AssessmentStateBadge } from "@/components/workspace/assessment-state-badge"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useApi } from "@/hooks/use-api"
import { ROUTES } from "@/lib/constants"
import type { ApplicationContext, CandidateJourney as JourneyPayload, MinimalJob } from "@/lib/types"

/**
 * Job-scoped recruitment panel for the candidate profile.
 *
 * A candidate profile is really a set of APPLICATIONS — one per job — and a
 * stage belongs to an application, not to the person. This panel picks the job
 * and then shows, for that application only:
 *
 *   • the authoritative stage (read from `job_applications.current_stage`)
 *   • the shortlist decision and who made it
 *   • the screening score, preserved
 *   • the assessment state and pinned version
 *   • the full journey, each completed step linking to its own record
 *   • the actions available right now, with invalid ones disabled and explained
 *
 * The legacy global actions (Hire / Reject / Send Email) remain above; this adds
 * the per-job decision path rather than replacing it.
 */
export function CandidateApplicationPanel({ candidateId }: { candidateId: string }) {
  const api = useApi()
  const router = useRouter()
  const searchParams = useSearchParams()

  const jobParam = searchParams.get("job")
  const [jobId, setJobId] = useState<string | null>(jobParam)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<"Hold" | "Rejected" | null>(null)
  const [reason, setReason] = useState("")

  // SWR rather than effect-driven fetching — same pattern as the rest of the
  // app, and it satisfies the React Compiler's "no setState in an effect" rule.
  const { data: jobs = [] } = useSWR<MinimalJob[]>(`hirestack:jobs`, async () => {
    const res = await api.listJobs()
    return (res.data as MinimalJob[]) ?? []
  })

  const activeJobId = useMemo(() => {
    if (jobId && jobs.some((j) => j.id === jobId)) return jobId
    return jobs[0]?.id ?? null
  }, [jobId, jobs])

  const {
    data: bundle,
    isLoading: loading,
    mutate,
  } = useSWR<{ context: ApplicationContext; journey: JourneyPayload } | null>(
    activeJobId ? [`hirestack:application`, activeJobId, candidateId] : null,
    async (_key: string, jobId: string, candId: string) => {
      const [ctxRes, journeyRes] = await Promise.all([
        api.getApplicationContext(jobId, candId),
        api.getJourney(jobId, candId),
      ])
      return {
        context: (ctxRes.success ? ctxRes.data : null) as ApplicationContext,
        journey: (journeyRes.success ? journeyRes.data : null) as JourneyPayload,
      }
    },
  )

  const context = bundle?.context ?? null
  const journey = bundle?.journey ?? null

  function selectJob(next: string) {
    setJobId(next)
    const params = new URLSearchParams(searchParams.toString())
    params.set("job", next)
    router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false })
  }

  async function run(action: () => Promise<{ success: boolean; error?: string }>, successTitle: string) {
    setBusy(true)
    try {
      const res = await action()
      if (!res.success) throw new Error(res.error || "Action failed")
      toast.success(successTitle)
      setConfirm(null)
      setReason("")
      void mutate()
    } catch (err) {
      toast.error("Could not complete that action", {
        description: err instanceof Error ? err.message : "Unexpected error",
      })
    } finally {
      setBusy(false)
    }
  }

  const shortlisted = context?.application.stage === "Shortlisted"
  const canShortlist =
    !!context &&
    !context.readOnly &&
    !shortlisted &&
    !["Assessment", "Technical Round", "Interview", "Final Decision", "Hired", "Rejected", "Withdrawn"].includes(
      context.application.stage,
    )

  const available = context?.availableDecisions ?? []

  return (
    <section className="rounded-[10px] border border-border bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Route size={14} strokeWidth={1.75} className="text-faint" aria-hidden />
          <h3 className="text-[13px] font-medium text-ink">This candidate&apos;s application</h3>
        </div>
        <select
          value={jobId ?? ""}
          onChange={(e) => selectJob(e.target.value)}
          className="h-7 rounded-[7px] border border-border bg-surface px-2 text-[12px] text-ink"
          aria-label="Select job"
        >
          {jobs.length === 0 && <option value="">No jobs yet</option>}
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title}
              {j.status === "closed" ? " (closed)" : ""}
            </option>
          ))}
        </select>
      </header>

      <div className="space-y-4 p-4">
        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {!loading && !context && (
          <p className="text-[12.5px] text-muted">
            This candidate has no application on the selected job. Shortlisting creates one.
          </p>
        )}

        {!loading && context && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <StageBadge stage={context.application.stage} showDot />
              {context.application.shortlistedAt && (
                <Badge variant="ghost" title="Shortlisted by the recruiter">
                  <Star size={11} aria-hidden className="mr-1" />
                  {new Date(context.application.shortlistedAt).toLocaleDateString()}
                </Badge>
              )}
              {context.job.status === "closed" && <Badge variant="secondary">Job closed</Badge>}
              {context.assessment && (
                <AssessmentStateBadge
                  state={context.assessment.state}
                  version={context.assessment.snapshotVersion}
                />
              )}
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px] sm:grid-cols-3">
              <div>
                <dt className="text-faint">Screening score</dt>
                <dd className="font-data mt-0.5 text-ink">
                  {context.screening ? `${context.screening.overall}/100` : "Not screened"}
                  {context.screening?.overridden && (
                    <span className="ml-1.5 text-warning">override</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-faint">Assessment score</dt>
                <dd className="font-data mt-0.5 text-ink">
                  {context.assessment?.percentage != null
                    ? `${context.assessment.score}/${context.assessment.maxScore} · ${context.assessment.percentage}%`
                    : "Not completed"}
                </dd>
              </div>
              <div>
                <dt className="text-faint">Applied</dt>
                <dd className="mt-0.5 text-ink">
                  {new Date(context.application.appliedAt).toLocaleDateString()}
                </dd>
              </div>
            </dl>

            <div className="flex flex-wrap gap-1.5 border-t border-border pt-3.5">
              {shortlisted ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2.5 text-xs"
                  disabled={context.readOnly || busy}
                  onClick={() =>
                    run(
                      () => api.unshortlist(jobId!, candidateId, "Reversed from the candidate profile"),
                      "Shortlist reversed — the original decision stays in their history",
                    )
                  }
                >
                  {busy ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <X size={13} aria-hidden />}
                  Un-shortlist
                </Button>
              ) : (
                <Button
                  variant="action"
                  size="sm"
                  className="h-8 px-2.5 text-xs"
                  disabled={!canShortlist || busy}
                  title={
                    context.readOnly
                      ? "This job is closed. Reopen it to change shortlists."
                      : undefined
                  }
                  onClick={() =>
                    run(() => api.shortlist(jobId!, candidateId), "Candidate shortlisted for this job")
                  }
                >
                  {busy ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Star size={13} aria-hidden />}
                  Shortlist
                </Button>
              )}

              {available.includes("Technical Round") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2.5 text-xs"
                  disabled={context.readOnly || busy}
                  onClick={() =>
                    run(
                      () =>
                        api.decide(jobId!, candidateId, {
                          decision: "Technical Round",
                          ...(context.assessment?.percentage != null
                            ? {
                                percentage: context.assessment.percentage,
                                passed: context.assessment.passed ?? undefined,
                                assessmentId: context.assessment.assessmentId ?? undefined,
                              }
                            : {}),
                        }),
                      "Moved to the Technical round",
                    )
                  }
                >
                  <Briefcase size={13} aria-hidden />
                  Move to Technical round
                </Button>
              )}

              {available.includes("Interview") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2.5 text-xs"
                  disabled={context.readOnly || busy}
                  onClick={() =>
                    run(
                      () => api.decide(jobId!, candidateId, { decision: "Interview" }),
                      "Moved to the Interview stage",
                    )
                  }
                >
                  Move to Interview
                </Button>
              )}

              {available.includes("Final Decision") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2.5 text-xs"
                  disabled={context.readOnly || busy}
                  onClick={() =>
                    run(
                      () => api.decide(jobId!, candidateId, { decision: "Final Decision" }),
                      "Ready for a final hiring decision",
                    )
                  }
                >
                  <Gavel size={13} aria-hidden />
                  Ready for decision
                </Button>
              )}

              {available.includes("Hold") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2.5 text-xs"
                  disabled={context.readOnly || busy}
                  onClick={() => {
                    setConfirm("Hold")
                    setReason("")
                  }}
                >
                  <PauseCircle size={13} aria-hidden />
                  Hold
                </Button>
              )}

              {available.includes("Rejected") && (
                <Button
                  variant="destructive-ghost"
                  size="sm"
                  className="h-8 px-2.5 text-xs"
                  disabled={context.readOnly || busy}
                  onClick={() => {
                    setConfirm("Rejected")
                    setReason("")
                  }}
                >
                  <CircleX size={13} aria-hidden />
                  Reject for this job
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 text-xs sm:ml-auto"
                render={
                  <a href={ROUTES.workspace(jobId ?? undefined, "results")} />
                }
              >
                Open in workspace
              </Button>
            </div>

            {context.readOnly && (
              <p className="text-[11.5px] text-warning">
                {context.job.title} is closed. You can review this application, but no new actions
                are possible until it is reopened.
              </p>
            )}
          </>
        )}

        {journey && journey.steps.length > 0 && (
          <div className="border-t border-border pt-3.5">
            <h4 className="mb-3 text-[12px] font-medium text-ink">Journey</h4>
            <CandidateJourney steps={journey.steps} />
          </div>
        )}
      </div>

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="max-w-md">
          <div className="px-6 pt-6">
            <h2 className="text-[16px] font-medium text-ink">
              {confirm === "Rejected" ? "Reject" : "Hold"} for {context?.job.title}?
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              This applies to{" "}
              <strong className="text-ink">this job only</strong>. Their assessment scores, report
              and full history are kept, and the decision is recorded against your account.
            </p>
            <div className="mt-4">
              <label htmlFor="profile-decision-reason" className="text-[12px] font-medium text-ink">
                Reason <span className="font-normal text-faint">(optional)</span>
              </label>
              <Textarea
                id="profile-decision-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="mt-1.5"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 px-6 pb-6 pt-4">
            <Button variant="ghost" size="sm" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant={confirm === "Rejected" ? "destructive" : "action"}
              size="sm"
              disabled={busy}
              onClick={() =>
                confirm &&
                run(
                  () => api.decide(jobId!, candidateId, { decision: confirm, reason: reason || undefined }),
                  `Marked as ${confirm.toLowerCase()} for this job`,
                )
              }
            >
              {busy && <Loader2 size={13} className="animate-spin" aria-hidden />}
              {confirm === "Rejected" ? "Reject" : "Hold"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}