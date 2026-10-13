"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ClipboardList, ExternalLink, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { useApi } from "@/hooks/use-api"
import { ROUTES } from "@/lib/constants"
import type { WorkspacePayload } from "@/lib/types"

/**
 * Stage 2 — Assessment setup.
 *
 * Generates a job-specific assessment from the job's own description and
 * required skills, using the existing AI provider and generation service. The
 * recruiter then previews, edits, regenerates and approves questions in the
 * assessment editor before anything is sent.
 *
 * Publishing freezes an immutable question snapshot; invites issued after that
 * are pinned to it, so a later regeneration cannot retroactively change what a
 * candidate is graded against.
 */
export function AssessmentSetupStage({ workspace }: { workspace: WorkspacePayload }) {
  const api = useApi();
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const { job, assessments, readOnly } = workspace

  const published = assessments.find((a) => a.status === "published")
  const drafts = assessments.filter((a) => a.status !== "published")

  async function generate() {
    if (readOnly) {
      toast.error(`"${job.title}" is closed. Reopen it to generate an assessment.`)
      return
    }
    setGenerating(true)
    try {
      const res = await api.generateAssessment({
        job_id: job.id,
        question_types: { mcq: 8, coding: 2, sql: 1, subjective: 2 },
        difficulty: "mixed",
        duration_minutes: 60,
        passing_score: 60,
        marks_per_question: 2,
      })
      if (!res.success) throw new Error(res.error || "Could not generate an assessment")
      const data = res.data as { assessmentId: string; dropped: number }
      toast.success("Draft assessment generated", {
        description:
          data.dropped > 0
            ? `${data.dropped} question(s) were dropped for failing validation. Review the draft before sending.`
            : "Review, edit and approve the questions before inviting anyone.",
      })
      router.push(ROUTES.assessmentDetail(data.assessmentId))
    } catch (err) {
      toast.error("Generation failed", {
        description: err instanceof Error ? err.message : "Unexpected error",
      })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-surface p-4">
        <div className="min-w-0">
          <h3 className="text-[13px] font-medium text-ink">Job-specific assessment</h3>
          <p className="mt-1 max-w-prose text-[12.5px] leading-relaxed text-muted">
            Generated from this job&apos;s description, responsibilities, required skills and
            experience level. Nothing is sent until you approve and publish it, and publishing
            freezes the exact question set each invitation is graded against.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-xs"
            render={<Link href={ROUTES.assessmentNew} />}
          >
            <ClipboardList size={13} aria-hidden />
            Build manually
          </Button>
          <Button
            variant="action"
            size="sm"
            className="h-8 px-2.5 text-xs"
            onClick={generate}
            disabled={generating || readOnly}
          >
            {generating ? (
              <Loader2 size={13} className="animate-spin" aria-hidden />
            ) : (
              <Sparkles size={13} aria-hidden />
            )}
            Generate from job description
          </Button>
        </div>
      </div>

      {readOnly && (
        <p className="rounded-[8px] border border-warning/25 bg-warning/10 px-3 py-2 text-[12px] text-warning">
          This job is closed. Existing assessments stay readable below, but no new assessment can
          be generated or invited until the job is reopened.
        </p>
      )}

      {assessments.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No assessment for this job yet"
          description="Generate one from the job description, or build it by hand. You will be able to preview, edit and approve every question before anything is sent."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-[0.06em] text-faint">
                <th scope="col" className="px-4 py-2.5 font-medium">Assessment</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Questions</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Pass mark</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Version</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium" />
              </tr>
            </thead>
            <tbody>
              {published && (
                <tr className="border-b border-border bg-success/[0.03]">
                  <td className="px-4 py-3">
                    <span className="text-[13px] font-medium text-ink">{published.name}</span>
                    <span className="mt-0.5 block text-[11.5px] text-faint">
                      {published.durationMinutes} min · {published.inviteCount} invitation(s)
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="success">Published</Badge>
                  </td>
                  <td className="px-4 py-3 font-data text-[12.5px] text-ink">
                    {published.totalQuestions} · {published.totalMarks} marks
                  </td>
                  <td className="px-4 py-3 font-data text-[12.5px] text-ink">{published.passingScore}%</td>
                  <td className="px-4 py-3 font-data text-[12.5px] text-ink">
                    v{published.snapshotVersion || "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2.5 text-xs"
                      render={<Link href={ROUTES.assessmentDetail(published.id)} />}
                    >
                      <ExternalLink size={13} aria-hidden />
                      Open
                    </Button>
                  </td>
                </tr>
              )}
              {drafts.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3">
                    <span className="text-[13px] font-medium text-ink">{a.name}</span>
                    <span className="mt-0.5 block text-[11.5px] text-faint">{a.durationMinutes} min</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">Draft</Badge>
                  </td>
                  <td className="px-4 py-3 font-data text-[12.5px] text-ink">
                    {a.totalQuestions} · {a.totalMarks} marks
                  </td>
                  <td className="px-4 py-3 font-data text-[12.5px] text-ink">{a.passingScore}%</td>
                  <td className="px-4 py-3 font-data text-[12.5px] text-faint">—</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2.5 text-xs"
                      render={<Link href={ROUTES.assessmentDetail(a.id)} />}
                    >
                      <ExternalLink size={13} aria-hidden />
                      Review & approve
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}