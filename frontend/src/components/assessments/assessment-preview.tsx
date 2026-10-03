"use client"

import { CheckCircle2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { AssessmentDetail, AssessmentQuestion, McqOption } from "@/lib/types"
import { QUESTION_TYPE_LABELS } from "./question-editors"

function optionsOf(q: AssessmentQuestion): McqOption[] {
  const raw = q.payload?.options
  if (!Array.isArray(raw)) return []
  return raw.map((o, i) => {
    if (typeof o === "string") return { id: `opt-${i + 1}`, text: o }
    const rec = (o || {}) as { id?: unknown; text?: unknown }
    return {
      id: typeof rec.id === "string" && rec.id ? rec.id : `opt-${i + 1}`,
      text: typeof rec.text === "string" ? rec.text : "",
    }
  })
}

function PreviewBody({ q }: { q: AssessmentQuestion }) {
  const p = q.payload || {}
  if (q.type === "mcq") {
    const options = optionsOf(q)
    const correct = typeof p.correct_option_id === "string" ? p.correct_option_id : ""
    return (
      <div className="mt-2 space-y-1.5">
        {options.map((o) => (
          <div
            key={o.id}
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
              o.id === correct ? "border-success/40 bg-success/5 text-ink" : "border-border text-muted"
            }`}
          >
            <span className="size-4 rounded-full border border-border-hover" />
            <span>{o.text || <span className="text-faint">(empty option)</span>}</span>
            {o.id === correct && <CheckCircle2 className="ml-auto size-4 shrink-0 text-success" />}
          </div>
        ))}
      </div>
    )
  }
  if (q.type === "coding") {
    const cases = Array.isArray(p.test_cases) ? p.test_cases : []
    return (
      <div className="mt-2 space-y-2">
        <p className="text-xs text-faint">Language: <span className="font-mono text-muted">{String(p.language || "—")}</span></p>
        {String(p.starter_code || "") && (
          <pre className="overflow-x-auto rounded-md bg-surface-secondary p-3 font-mono text-xs text-ink">
            {String(p.starter_code)}
          </pre>
        )}
        <p className="text-xs text-faint">{cases.length} test case{cases.length === 1 ? "" : "s"}</p>
      </div>
    )
  }
  if (q.type === "sql") {
    const schema = p.schema_ddl ?? p.schema
    return (
      <div className="mt-2 space-y-2">
        {String(schema || "") && (
          <pre className="overflow-x-auto rounded-md bg-surface-secondary p-3 font-mono text-xs text-ink">
            {String(schema)}
          </pre>
        )}
      </div>
    )
  }
  return (
    <div className="mt-2 rounded-md border border-border p-3 text-sm text-muted">
      <p className="text-xs font-medium uppercase tracking-wide text-faint mb-1">Evaluation rubric</p>
      <p className="whitespace-pre-line">{String(p.rubric || "—")}</p>
    </div>
  )
}

export function AssessmentPreview({ assessment }: { assessment: AssessmentDetail }) {
  const questions = assessment.questions || []
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-medium text-ink">{assessment.name || "Untitled assessment"}</h3>
          <Badge variant={assessment.status === "published" ? "success" : "warning"}>{assessment.status}</Badge>
        </div>
        {assessment.description && <p className="mt-1 text-sm text-muted">{assessment.description}</p>}
        {assessment.instructions && (
          <p className="mt-2 whitespace-pre-line rounded-md bg-surface-secondary p-3 text-sm text-muted">
            {assessment.instructions}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-faint">
          <span>Duration: <strong className="text-muted">{assessment.duration_minutes} min</strong></span>
          <span>Passing: <strong className="text-muted">{assessment.passing_score} / {assessment.totalMarks}</strong></span>
          <span>Questions: <strong className="text-muted">{assessment.totalQuestions}</strong></span>
          {assessment.skills?.length > 0 && <span>Skills: <strong className="text-muted">{assessment.skills.join(", ")}</strong></span>}
        </div>
        <p className="mt-3 text-xs text-faint">
          Recruiter preview — this is how the structure will look before publishing. No timer, execution, or scoring runs here.
        </p>
      </div>
      {questions.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-6 text-center text-sm text-muted">
          No questions yet. Add questions to see them here.
        </div>
      ) : (
        questions.map((q, i) => (
          <div key={q.id} className="rounded-lg border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-ink">Q{i + 1}.</span>
              <Badge variant="secondary">{QUESTION_TYPE_LABELS[q.type] || q.type}</Badge>
              <Badge variant={q.is_required ? "default" : "warning"}>{q.is_required ? "Required" : "Optional"}</Badge>
              <span className="ml-auto text-xs text-faint">{q.marks} mark{q.marks === 1 ? "" : "s"}{q.skill_tag ? ` · ${q.skill_tag}` : ""}</span>
            </div>
            {q.title && <p className="mt-1 text-sm font-medium text-ink">{q.title}</p>}
            <p className="mt-1 whitespace-pre-line text-sm text-muted">{q.prompt}</p>
            <PreviewBody q={q} />
          </div>
        ))
      )}
      <div className="rounded-lg border border-border bg-surface p-4 text-sm text-muted">
        Total: <strong className="text-ink">{assessment.totalQuestions}</strong> questions ·{" "}
        <strong className="text-ink">{assessment.totalMarks}</strong> marks · passing{" "}
        <strong className="text-ink">{assessment.passing_score}</strong>
      </div>
    </div>
  )
}
