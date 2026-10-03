"use client"

import { use, useCallback, useEffect, useState, startTransition } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowUp, ArrowDown, Copy, Loader2, Pencil, Plus, Trash2, Rocket, Undo2,
} from "lucide-react"
import { toast } from "sonner"
import { useApi } from "@/hooks/use-api"
import { PageHeader } from "@/components/ui/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { ROUTES } from "@/lib/constants"
import type { AssessmentDetail, AssessmentQuestion } from "@/lib/types"
import { AssessmentDetailsForm, AssessmentSettingsForm } from "@/components/assessments/assessment-forms"
import { AssessmentPreview } from "@/components/assessments/assessment-preview"
import { InvitesPanel } from "@/components/assessments/invites-panel"
import { QuestionModal } from "@/components/assessments/question-modal"
import { QUESTION_TYPE_LABELS } from "@/components/assessments/question-editors"

type Tab = "details" | "questions" | "settings" | "preview" | "invites"

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "details", label: "Details" },
  { id: "questions", label: "Questions" },
  { id: "settings", label: "Settings" },
  { id: "preview", label: "Preview" },
  { id: "invites", label: "Invites" },
]

export default function AssessmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const api = useApi()
  const router = useRouter()
  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>("details")
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<AssessmentQuestion | null>(null)
  const [savingQuestion, setSavingQuestion] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [publishErrors, setPublishErrors] = useState<string[]>([])
  const [showDelete, setShowDelete] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.getAssessment(id)
      if (res.success && res.data) {
        const detail = res.data
        startTransition(() => setAssessment(detail ?? null))
      } else {
        toast.error(res.error || "Assessment not found")
      }
    } catch {
      toast.error("Failed to load assessment")
    } finally {
      startTransition(() => setLoading(false))
    }
  }, [api, id])

  useEffect(() => {
    load()
  }, [load])

  const refresh = async () => {
    const res = await api.getAssessment(id)
    if (res.success && res.data) setAssessment(res.data)
  }

  const handleSaveQuestion = async (body: Record<string, unknown>): Promise<boolean> => {
    setSavingQuestion(true)
    try {
      const res = editing
        ? await api.updateQuestion(id, editing.id, body)
        : await api.addQuestion(id, body)
      if (res.success) {
        toast.success(editing ? "Question updated" : "Question added")
        setModalOpen(false)
        setEditing(null)
        refresh()
        return true
      }
      const details = (res as unknown as { details?: string[] }).details
      toast.error(details?.join(" ") || res.error || "Failed to save question")
      return false
    } catch {
      toast.error("Failed to save question")
      return false
    } finally {
      setSavingQuestion(false)
    }
  }

  const handleDeleteQuestion = async (qid: string) => {
    setBusy(`del-${qid}`)
    try {
      const res = await api.deleteQuestion(id, qid)
      if (res.success) {
        toast.success("Question deleted")
        refresh()
      } else {
        toast.error(res.error || "Failed to delete")
      }
    } catch {
      toast.error("Failed to delete")
    } finally {
      setBusy(null)
    }
  }

  const handleDuplicate = async (qid: string) => {
    setBusy(`dup-${qid}`)
    try {
      const res = await api.duplicateQuestion(id, qid)
      if (res.success) {
        toast.success("Question duplicated")
        refresh()
      } else {
        toast.error(res.error || "Failed to duplicate")
      }
    } catch {
      toast.error("Failed to duplicate")
    } finally {
      setBusy(null)
    }
  }

  const handleMove = async (index: number, dir: -1 | 1) => {
    if (!assessment) return
    const qs = [...assessment.questions]
    const j = index + dir
    if (j < 0 || j >= qs.length) return
    const tmp = qs[index]
    qs[index] = qs[j]
    qs[j] = tmp
    setBusy(`move-${qs[index].id}`)
    try {
      const res = await api.reorderQuestions(id, qs.map((q) => q.id))
      if (res.success && res.data) {
        setAssessment({ ...assessment, questions: res.data })
      } else {
        toast.error(res.error || "Failed to reorder")
      }
    } catch {
      toast.error("Failed to reorder")
    } finally {
      setBusy(null)
    }
  }

  const handlePublish = async () => {
    setBusy("publish")
    setPublishErrors([])
    try {
      const res = await api.publishAssessment(id)
      if (res.success) {
        toast.success("Assessment published — invites are now available")
        setTab("invites")
        refresh()
      } else {
        const details = (res as unknown as { details?: string[] }).details
        if (details?.length) setPublishErrors(details)
        toast.error(res.error || "Not ready to publish")
      }
    } catch {
      toast.error("Failed to publish")
    } finally {
      setBusy(null)
    }
  }

  const handleUnpublish = async () => {
    setBusy("unpublish")
    try {
      const res = await api.unpublishAssessment(id)
      if (res.success) {
        toast.success("Moved back to draft — editing unlocked")
        refresh()
      } else {
        toast.error(res.error || "Failed to unpublish")
      }
    } catch {
      toast.error("Failed to unpublish")
    } finally {
      setBusy(null)
    }
  }

  const handleDelete = async () => {
    setBusy("delete")
    try {
      const res = await api.deleteAssessment(id)
      if (res.success) {
        toast.success("Assessment deleted")
        router.push(ROUTES.assessments)
      } else {
        toast.error(res.error || "Failed to delete")
      }
    } catch {
      toast.error("Failed to delete")
    } finally {
      setBusy(null)
      setShowDelete(false)
    }
  }

  if (loading) {
    return (
      <div className="pt-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!assessment) {
    return (
      <div className="pt-6">
        <p className="text-sm text-muted">Assessment not found.</p>
      </div>
    )
  }

  const locked = assessment.status === "published"
  const questions = assessment.questions || []

  return (
    <div className="pt-6 space-y-6">
      <PageHeader
        title={assessment.name || "Untitled assessment"}
        description={`${assessment.totalQuestions} questions · ${assessment.totalMarks} marks · passing ${assessment.passing_score}${assessment.job ? ` · ${assessment.job.title}` : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={locked ? "success" : "warning"}>{assessment.status}</Badge>
            {!locked ? (
              <Button size="sm" className="bg-ink text-canvas hover:bg-ink/90" onClick={handlePublish} disabled={busy === "publish"}>
                {busy === "publish" ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Rocket className="h-3.5 w-3.5 mr-1" />}
                Publish
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={handleUnpublish} disabled={busy === "unpublish"}>
                {busy === "unpublish" ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Undo2 className="h-3.5 w-3.5 mr-1" />}
                Unpublish to draft
              </Button>
            )}
          </div>
        }
      />

      {publishErrors.length > 0 && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 p-4">
          <p className="text-sm font-medium text-danger">Fix these before publishing:</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-muted">
            {publishErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {locked && (
        <p className="rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
          Published — questions and settings are locked so invited candidates always see the same test.
          Unpublish to draft to make changes.
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`h-8 rounded-lg px-3 text-xs font-medium transition-colors ${
              tab === t.id ? "bg-ink text-canvas" : "border border-border text-muted hover:bg-surface-secondary hover:text-ink"
            }`}
          >
            {t.label}
            {t.id === "questions" && ` (${assessment.totalQuestions})`}
            {t.id === "invites" && assessment.inviteCount > 0 && ` (${assessment.inviteCount})`}
          </button>
        ))}
        <button
          onClick={() => setShowDelete(true)}
          className="ml-auto inline-flex h-8 items-center gap-1 rounded-lg px-3 text-xs font-medium text-danger hover:bg-danger/10"
        >
          <Trash2 className="size-3.5" /> Delete
        </button>
      </div>

      {tab === "details" && (
        <AssessmentDetailsForm assessment={assessment} onSaved={setAssessment} />
      )}

      {tab === "questions" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3">
            <p className="text-sm text-muted">
              <strong className="text-ink">{assessment.totalQuestions}</strong> questions ·{" "}
              <strong className="text-ink">{assessment.totalMarks}</strong> total marks
            </p>
            {!locked && (
              <Button size="sm" className="bg-ink text-canvas hover:bg-ink/90" onClick={() => { setEditing(null); setModalOpen(true) }}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add question
              </Button>
            )}
          </div>
          {questions.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface p-8 text-center text-sm text-muted">
              No questions yet. Add MCQ, coding, SQL, or subjective questions.
            </div>
          ) : (
            questions.map((q, i) => (
              <div key={q.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-ink">Q{i + 1}.</span>
                  <Badge variant="secondary">{QUESTION_TYPE_LABELS[q.type] || q.type}</Badge>
                  <Badge variant={q.is_required ? "default" : "warning"}>{q.is_required ? "Required" : "Optional"}</Badge>
                  <span className="text-xs text-faint">{q.marks} marks{q.skill_tag ? ` · ${q.skill_tag}` : ""}</span>
                  {!locked && (
                    <div className="ml-auto flex items-center gap-0.5">
                      <button onClick={() => handleMove(i, -1)} disabled={i === 0 || busy !== null} className="flex size-7 items-center justify-center rounded-md text-faint hover:bg-surface-secondary hover:text-ink disabled:opacity-30" aria-label="Move up">
                        <ArrowUp className="size-3.5" />
                      </button>
                      <button onClick={() => handleMove(i, 1)} disabled={i === questions.length - 1 || busy !== null} className="flex size-7 items-center justify-center rounded-md text-faint hover:bg-surface-secondary hover:text-ink disabled:opacity-30" aria-label="Move down">
                        <ArrowDown className="size-3.5" />
                      </button>
                      <button onClick={() => { setEditing(q); setModalOpen(true) }} className="flex size-7 items-center justify-center rounded-md text-faint hover:bg-surface-secondary hover:text-ink" aria-label="Edit question">
                        <Pencil className="size-3.5" />
                      </button>
                      <button onClick={() => handleDuplicate(q.id)} disabled={busy !== null} className="flex size-7 items-center justify-center rounded-md text-faint hover:bg-surface-secondary hover:text-ink disabled:opacity-30" aria-label="Duplicate question">
                        {busy === `dup-${q.id}` ? <Loader2 className="size-3.5 animate-spin" /> : <Copy className="size-3.5" />}
                      </button>
                      <button onClick={() => handleDeleteQuestion(q.id)} disabled={busy !== null} className="flex size-7 items-center justify-center rounded-md text-faint hover:bg-danger/10 hover:text-danger disabled:opacity-30" aria-label="Delete question">
                        {busy === `del-${q.id}` ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                      </button>
                    </div>
                  )}
                </div>
                {q.title && <p className="mt-1 text-sm font-medium text-ink">{q.title}</p>}
                <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-sm text-muted">{q.prompt}</p>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "settings" && (
        <AssessmentSettingsForm assessment={assessment} onSaved={setAssessment} />
      )}

      {tab === "preview" && <AssessmentPreview assessment={assessment} />}

      {tab === "invites" && <InvitesPanel key={assessment.status} assessment={assessment} />}

      {modalOpen && (
        <QuestionModal
          key={editing?.id || "new"}
          open={modalOpen}
          onClose={() => { setModalOpen(false); setEditing(null) }}
          initial={editing}
          saving={savingQuestion}
          onSave={handleSaveQuestion}
        />
      )}

      <Dialog open={showDelete} onOpenChange={(o) => !o && setShowDelete(false)}>
        <DialogContent className="sm:max-w-md">
          <div className="px-6 pt-6 pb-2">
            <h2 className="text-base font-medium text-ink">Delete assessment?</h2>
            <p className="mt-1 text-sm text-muted">
              “{assessment.name || "Untitled"}” and its {assessment.totalQuestions} questions
              {assessment.inviteCount > 0 ? ` and ${assessment.inviteCount} invitation${assessment.inviteCount === 1 ? "" : "s"}` : ""} will
              be permanently removed. Sent emails cannot be recalled.
            </p>
          </div>
          <div className="px-6 pb-6 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowDelete(false)} disabled={busy === "delete"}>Cancel</Button>
            <Button size="sm" variant="destructive" onClick={handleDelete} disabled={busy === "delete"}>
              {busy === "delete" && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
