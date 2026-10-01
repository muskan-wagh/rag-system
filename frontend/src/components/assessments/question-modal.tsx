"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import type { AssessmentQuestion, AssessmentQuestionType } from "@/lib/types"
import {
  McqEditor,
  CodingEditor,
  SqlEditor,
  SubjectiveEditor,
  QUESTION_TYPE_LABELS,
  normalizeOptions,
  normalizeTestCases,
  inputCls,
  textareaCls,
  labelCls,
} from "./question-editors"

const TYPES: AssessmentQuestionType[] = ["mcq", "coding", "sql", "subjective"]

function defaultPayload(type: AssessmentQuestionType): Record<string, unknown> {
  switch (type) {
    case "mcq":
      return { options: normalizeOptions([]), correct_option_id: "" }
    case "coding":
      return { language: "python", starter_code: "", test_cases: normalizeTestCases([]) }
    case "sql":
      return { schema_ddl: "", expected_query: "", expected_result: "" }
    case "subjective":
      return { rubric: "" }
  }
}

interface QuestionModalProps {
  open: boolean
  onClose: () => void
  initial: AssessmentQuestion | null
  saving: boolean
  onSave: (body: Record<string, unknown>) => Promise<boolean>
}

export function QuestionModal({ open, onClose, initial, saving, onSave }: QuestionModalProps) {
  const [type, setType] = useState<AssessmentQuestionType>(initial?.type || "mcq")
  const [title, setTitle] = useState(initial?.title || "")
  const [prompt, setPrompt] = useState(initial?.prompt || "")
  const [marks, setMarks] = useState(String(initial?.marks ?? 1))
  const [skillTag, setSkillTag] = useState(initial?.skill_tag || "")
  const [isRequired, setIsRequired] = useState(initial?.is_required ?? true)
  const [payload, setPayload] = useState<Record<string, unknown>>(
    initial?.payload || defaultPayload(initial?.type || "mcq"),
  )

  const switchType = (next: AssessmentQuestionType) => {
    setType(next)
    setPayload(defaultPayload(next))
  }

  const handleSave = async () => {
    if (!prompt.trim()) {
      toast.error("Question prompt is required")
      return
    }
    const marksNum = Number(marks)
    if (!Number.isFinite(marksNum) || marksNum < 0) {
      toast.error("Marks must be a number >= 0")
      return
    }
    if (type === "mcq") {
      const options = normalizeOptions(payload.options)
      if (options.length < 2 || options.some((o) => !o.text.trim())) {
        toast.error("MCQ needs at least 2 non-empty options")
        return
      }
      const correct = payload.correct_option_id
      if (typeof correct !== "string" || !options.some((o) => o.id === correct)) {
        toast.error("Select the correct MCQ option")
        return
      }
    }
    if (type === "coding") {
      if (!String(payload.language || "").trim() || !String(payload.starter_code || "").trim()) {
        toast.error("Coding needs a language and starter code")
        return
      }
      const cases = normalizeTestCases(payload.test_cases)
      if (cases.length === 0 || cases.some((c) => typeof c.expected_output !== "string")) {
        toast.error("Coding needs at least 1 test case with expected output")
        return
      }
    }
    if (type === "sql") {
      const schema = payload.schema_ddl ?? payload.schema
      const query = payload.expected_query ?? payload.expected_sql
      if (!String(schema || "").trim()) {
        toast.error("SQL needs a schema definition")
        return
      }
      if (!String(query || "").trim() && !String(payload.expected_result || "").trim()) {
        toast.error("SQL needs an expected query or expected result")
        return
      }
    }
    if (type === "subjective" && !String(payload.rubric || "").trim()) {
      toast.error("Subjective needs an evaluation rubric")
      return
    }
    const ok = await onSave({
      type,
      title: title.trim(),
      prompt: prompt.trim(),
      marks: marksNum,
      skill_tag: skillTag.trim(),
      is_required: isRequired,
      payload,
    })
    if (ok) onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 pt-6 pb-2">
          <h2 className="text-base font-medium text-ink">
            {initial ? "Edit question" : "Add question"}
          </h2>
          <p className="text-sm text-muted mt-0.5">Fill every required field — publishing validates again server-side.</p>
        </div>
        <div className="px-6 pb-6 space-y-4">
          <div>
            <label className={labelCls}>Question type</label>
            <div className="flex flex-wrap gap-1.5">
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => switchType(t)}
                  className={`h-8 rounded-lg px-3 text-xs font-medium transition-colors ${
                    type === t
                      ? "bg-ink text-canvas"
                      : "border border-border text-muted hover:bg-surface-secondary hover:text-ink"
                  }`}
                >
                  {QUESTION_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Short title (optional)</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Array reversal" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Question / problem statement</label>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} className={textareaCls} />
          </div>
          {type === "mcq" && <McqEditor payload={payload} onChange={setPayload} />}
          {type === "coding" && <CodingEditor payload={payload} onChange={setPayload} />}
          {type === "sql" && <SqlEditor payload={payload} onChange={setPayload} />}
          {type === "subjective" && <SubjectiveEditor payload={payload} onChange={setPayload} />}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Marks</label>
              <input type="number" min={0} step="any" value={marks} onChange={(e) => setMarks(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Skill / tag</label>
              <input type="text" value={skillTag} onChange={(e) => setSkillTag(e.target.value)} placeholder="e.g. arrays" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Required?</label>
              <select value={isRequired ? "yes" : "no"} onChange={(e) => setIsRequired(e.target.value === "yes")} className={inputCls}>
                <option value="yes">Required</option>
                <option value="no">Optional</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button size="sm" className="bg-ink text-canvas hover:bg-ink/90" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              {initial ? "Save changes" : "Add question"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
