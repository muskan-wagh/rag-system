"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { useSearchParams, useRouter } from "next/navigation"
import { PageHeader } from "@/components/ui/page-header"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs"
import { Briefcase, RefreshCw, TriangleAlert } from "lucide-react"
import { JobSwitcher } from "@/components/workspace/job-switcher"
import { ShortlistingStage, StageSkeleton } from "@/components/workspace/shortlisting-stage"
import { AssessmentSetupStage } from "@/components/workspace/assessment-setup-stage"
import { InvitationsStage } from "@/components/workspace/invitations-stage"
import { ResultsStage, ClosedJobBanner } from "@/components/workspace/results-stage"
import { TechnicalRoundStage } from "@/components/workspace/technical-round-stage"
import { InterviewDecisionStage } from "@/components/workspace/interview-decision-stage"
import { JobsTab } from "@/components/workspace/jobs-tab"
import { useApi } from "@/hooks/use-api"
import { toReadableError } from "@/lib/http"
import { WORKSPACE_STAGES, WORKSPACE_STAGE_META, type WorkspaceStage } from "@/lib/constants"
import type { MinimalJob, WorkspacePayload } from "@/lib/types"

/**
 * The Assessments workspace.
 *
 * This replaced four disconnected sections (Shortlisting, Assessments, Technical
 * assessments / Coding rounds, Interviews) and the standalone Jobs page. A
 * recruiter manages one candidate's entire journey — screening, shortlist,
 * assessment, invitation, result, report, technical round, interview, decision —
 * from this single screen, scoped to one job at a time.
 *
 * Every panel reads from ONE payload (`GET /jobs/:jobId/workspace`) whose
 * backend derives stage from `job_applications.current_stage`. There is no
 * client-side derivation, so no two panels can disagree about where a candidate
 * is.
 */
export default function AssessmentsWorkspacePage() {
  const api = useApi()
  const router = useRouter()
  const searchParams = useSearchParams()

  const jobParam = searchParams.get("job")
  const stageParam = searchParams.get("stage") as WorkspaceStage | null
  const [jobId, setJobId] = useState<string | null>(jobParam)
  const [stage, setStage] = useState<WorkspaceStage>(
    stageParam && WORKSPACE_STAGES.includes(stageParam) ? stageParam : "shortlisting",
  )

  // SWR rather than effect-driven fetching: it dedupes, keeps the previous data
  // visible while a job switches over, and satisfies the React Compiler's
  // "no setState in an effect" rule.
  const {
    data: jobs = [],
    isLoading: loadingJobs,
    error: jobsError,
    mutate: mutateJobs,
  } = useSWR<MinimalJob[]>("hirestack:jobs", async () => {
    const res = await api.listJobs()
    if (!res.success) throw new Error(res.error || "Could not load your roles")
    return res.data ?? []
  })

  // Default to the first open role, then the most recent role of any status.
  const activeJobId = useMemo(() => {
    if (jobId && jobs.some((j) => j.id === jobId)) return jobId
    return jobs.find((j) => j.status !== "closed")?.id ?? jobs[0]?.id ?? null
  }, [jobId, jobs])

  const {
    data: workspace,
    isLoading: loadingWorkspace,
    error: workspaceError,
    mutate: mutateWorkspace,
  } = useSWR<WorkspacePayload>(
    activeJobId ? ["hirestack:workspace", activeJobId] : null,
    async (_key: string, id: string) => {
      const res = await api.getWorkspace(id)
      if (!res.success) throw new Error(res.error || "Could not load this job's pipeline")
      return res.data as WorkspacePayload
    },
  )

  // Keep the URL in sync so a stage is shareable and survives a refresh.
  useEffect(() => {
    if (!activeJobId) return
    const next = new URLSearchParams()
    next.set("job", activeJobId)
    next.set("stage", stage)
    router.replace(`${window.location.pathname}?${next.toString()}`, { scroll: false })
  }, [activeJobId, stage, router])

  function selectJob(nextJobId: string) {
    setJobId(nextJobId)
    void mutateWorkspace(undefined, { revalidate: false })
  }

  const refresh = useCallback(() => {
    void mutateJobs()
    void mutateWorkspace()
  }, [mutateJobs, mutateWorkspace])

  const error = jobsError ?? workspaceError
  const errorMessage = error ? toReadableError(error, "Could not load this workspace.") : null

  /**
   * Skeletons are for work in flight only. On failure `isLoading` is false and
   * `workspace` is undefined, so keying the skeleton on `!workspace` alone left
   * the panel spinning forever under the error text. A failed load must resolve
   * to an error card with a retry, never a perpetual skeleton.
   */
  const showWorkspaceSkeleton = loadingWorkspace && !workspace && !error
  const showWorkspaceError = Boolean(workspaceError) && !workspace

  const tiles = useMemo(() => {
    if (!workspace) return []
    const c = workspace.counts
    return [
      { label: "Shortlisted", value: c.shortlisted, stage: "shortlisting" as const },
      { label: "Invited", value: c.invited, stage: "invitations" as const },
      { label: "In progress", value: c.inProgress, stage: "results" as const },
      { label: "Completed", value: c.completed, stage: "results" as const },
      { label: "Failed", value: c.failed, stage: "results" as const },
      { label: "Technical round", value: c.technicalRound, stage: "technical" as const },
    ]
  }, [workspace])

  return (
    <div className="space-y-5">
      <PageHeader
        title="Assessments"
        description="One workspace per role: shortlist, build the assessment, send invitations, review results, and make the hiring call — without leaving the screen."
        actions={
          <div className="flex items-center gap-2">
            <JobSwitcher jobs={jobs} selectedJobId={jobId} onSelect={selectJob} />
          </div>
        }
      />

      {workspace && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={workspace.job.status === "closed" ? "secondary" : "success"}>
            {workspace.job.status === "closed" ? "Closed" : "Open"}
          </Badge>
          <span className="text-[12px] text-muted">
            {workspace.counts.applied + workspace.counts.screening + workspace.counts.shortlisted +
              workspace.counts.assessment + workspace.counts.technicalRound +
              workspace.counts.interview + workspace.counts.finalDecision +
              workspace.counts.hired + workspace.counts.rejected + workspace.counts.hold}{" "}
            candidate{workspace.pipeline.length === 1 ? "" : "s"} in this pipeline
          </span>
        </div>
      )}

      {workspace?.readOnly && <ClosedJobBanner title={workspace.job.title} />}

      {errorMessage && (
        <div
          role="alert"
          className="flex flex-wrap items-start justify-between gap-3 rounded-[8px] border border-danger/25 bg-danger/10 px-3 py-2 text-[12.5px] text-danger"
        >
          <span className="flex items-start gap-2">
            <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden />
            <span>{errorMessage}</span>
          </span>
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-1.5 rounded-[6px] border border-danger/30 px-2 py-1 font-medium transition-colors duration-120 hover:bg-danger/15"
          >
            <RefreshCw className="size-3.5" aria-hidden />
            Retry
          </button>
        </div>
      )}

      {!loadingJobs && jobs.length === 0 && !error && (
        <EmptyState
          icon={Briefcase}
          title="No roles yet"
          description="Create a role to start screening, shortlisting and assessing candidates."
        />
      )}

      {loadingJobs && (
        <div className="space-y-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {!loadingJobs && jobs.length > 0 && (
        <Tabs value={stage} onValueChange={(v) => setStage(v as WorkspaceStage)}>
          <TabsList className="flex-wrap">
            {WORKSPACE_STAGES.map((s) => (
              <TabsTab key={s} value={s}>
                {WORKSPACE_STAGE_META[s].label}
              </TabsTab>
            ))}
          </TabsList>

          {/* Jobs tab needs the job list, not a workspace payload. */}
          <TabsPanel value="jobs">
            <JobsTab
              jobs={jobs}
              workspace={workspace ?? null}
              onJobSelected={selectJob}
              onChanged={refresh}
            />
          </TabsPanel>

          {WORKSPACE_STAGES.filter((s) => s !== "jobs").map((s) => (
            <TabsPanel key={s} value={s}>
              {showWorkspaceSkeleton ? (
                <div aria-busy="true" aria-live="polite">
                  <StageSkeleton />
                </div>
              ) : showWorkspaceError ? (
                <div
                  role="alert"
                  className="flex flex-col items-start gap-3 rounded-[8px] border border-danger/25 bg-danger/5 px-4 py-6 text-[12.5px] text-danger"
                >
                  <span className="flex items-start gap-2">
                    <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden />
                    <span>
                      Could not load this role&apos;s pipeline.
                      <span className="mt-1 block text-muted">{errorMessage}</span>
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void mutateWorkspace()}
                    className="inline-flex items-center gap-1.5 rounded-[6px] border border-danger/30 px-2.5 py-1 font-medium transition-colors duration-120 hover:bg-danger/15"
                  >
                    <RefreshCw className="size-3.5" aria-hidden />
                    Try again
                  </button>
                </div>
              ) : workspace ? (
                <>
                  {s === "shortlisting" && (
                    <ShortlistingStage workspace={workspace} onChanged={refresh} />
                  )}
                  {s === "setup" && <AssessmentSetupStage workspace={workspace} />}
                  {s === "invitations" && (
                    <InvitationsStage workspace={workspace} onChanged={refresh} />
                  )}
                  {s === "results" && (
                    <ResultsStage workspace={workspace} onChanged={refresh} />
                  )}
                  {s === "technical" && (
                    <TechnicalRoundStage workspace={workspace} onChanged={refresh} />
                  )}
                  {s === "interview" && (
                    <InterviewDecisionStage workspace={workspace} onChanged={refresh} />
                  )}
                </>
              ) : (
                <EmptyState
                  icon={Briefcase}
                  title="No role selected"
                  description="Pick a role from the switcher above to see its pipeline."
                />
              )}
            </TabsPanel>
          ))}
        </Tabs>
      )}

      {!loadingWorkspace && workspace && stage !== "jobs" && (
        <div className="grid grid-cols-2 gap-2 border-t border-border pt-4 sm:grid-cols-3 lg:grid-cols-6">
          {tiles.map((tile) => (
            <button
              key={tile.label}
              type="button"
              onClick={() => setStage(tile.stage)}
              className="rounded-[8px] border border-border bg-surface p-3 text-left transition-colors duration-120 hover:bg-surface-secondary"
            >
              <span className="block font-data text-[18px] font-medium tabular-nums text-ink">
                {tile.value}
              </span>
              <span className="mt-0.5 block text-[11px] text-faint">{tile.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}