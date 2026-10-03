"use client"

import { Plus, Trash2 } from "lucide-react"
import type { AssessmentQuestionType, McqOption } from "@/lib/types"

export const inputCls =
  "w-full h-9 px-3 text-sm rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60"
export const textareaCls =
  "w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60"
export const labelCls = "text-xs font-medium text-muted-foreground mb-1 block"
export const monoCls =
  "w-full px-3 py-2 text-[13px] font-mono rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"

function newOptionId(existing: McqOption[]): string {
  let n = existing.length + 1
  const ids = new Set(existing.map((o) => o.id))
  while (ids.has(`opt-${n}`)) n += 1
  return `opt-${n}`
}

export function normalizeOptions(raw: unknown): McqOption[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [
      { id: "opt-1", text: "" },
      { id: "opt-2", text: "" },
    ]
  }
  return raw.map((entry, i) => {
    if (typeof entry === "string") return { id: `opt-${i + 1}`, text: entry }
    const rec = (entry || {}) as { id?: unknown; text?: unknown }
    return {
      id: typeof rec.id === "string" && rec.id ? rec.id : `opt-${i + 1}`,
      text: typeof rec.text === "string" ? rec.text : "",
    }
  })
}

// ---------- MCQ ----------

export function McqEditor({
  payload,
  onChange,
}: {
  payload: Record<string, unknown>
  onChange: (payload: Record<string, unknown>) => void
}) {
  const options = normalizeOptions(payload.options)
  const correct = typeof payload.correct_option_id === "string" ? payload.correct_option_id : ""

  const set = (next: McqOption[], nextCorrect: string) =>
    onChange({ ...payload, options: next, correct_option_id: nextCorrect })

  return (
    <div className="space-y-2">
      <label className={labelCls}>Options (select the correct answer)</label>
      {options.map((opt, i) => (
        <div key={opt.id} className="flex items-center gap-2">
          <input
            type="radio"
            name="mcq-correct"
            checked={correct === opt.id}
            onChange={() => set(options, opt.id)}
            aria-label={`Mark option ${i + 1} as correct`}
            className="size-4 shrink-0 accent-primary"
          />
          <input
            type="text"
            value={opt.text}
            onChange={(e) => {
              const next = options.map((o) => (o.id === opt.id ? { ...o, text: e.target.value } : o))
              set(next, correct)
            }}
            placeholder={`Option ${i + 1}`}
            className={inputCls}
          />
          <button
            type="button"
            disabled={options.length <= 2}
            onClick={() => {
              const next = options.filter((o) => o.id !== opt.id)
              set(next, correct === opt.id ? "" : correct)
            }}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-faint transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-30"
            aria-label={`Remove option ${i + 1}`}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => set([...options, { id: newOptionId(options), text: "" }], correct)}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted transition-colors hover:bg-surface-secondary hover:text-ink"
      >
        <Plus className="size-3.5" /> Add option
      </button>
    </div>
  )
}

// ---------- Coding ----------

const CODING_LANGUAGES = ["python", "javascript", "typescript", "java", "c", "cpp", "go", "rust", "csharp", "ruby"]

export interface CodingTestCase {
  input: string
  expected_output: string
}

export function normalizeTestCases(raw: unknown): CodingTestCase[] {
  if (!Array.isArray(raw) || raw.length === 0) return [{ input: "", expected_output: "" }]
  return raw.map((tc) => {
    const rec = (tc || {}) as { input?: unknown; expected_output?: unknown }
    return {
      input: typeof rec.input === "string" ? rec.input : "",
      expected_output: typeof rec.expected_output === "string" ? rec.expected_output : "",
    }
  })
}

export function CodingEditor({
  payload,
  onChange,
}: {
  payload: Record<string, unknown>
  onChange: (payload: Record<string, unknown>) => void
}) {
  const language = typeof payload.language === "string" ? payload.language : "python"
  const starter = typeof payload.starter_code === "string" ? payload.starter_code : ""
  const cases = normalizeTestCases(payload.test_cases)

  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Programming language</label>
        <select
          value={language}
          onChange={(e) => onChange({ ...payload, language: e.target.value })}
          className={inputCls}
        >
          {CODING_LANGUAGES.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>Starter code</label>
        <textarea
          value={starter}
          onChange={(e) => onChange({ ...payload, starter_code: e.target.value })}
          rows={5}
          spellCheck={false}
          placeholder="def solve(...): ..."
          className={monoCls}
        />
      </div>
      <div className="space-y-2">
        <label className={labelCls}>Test cases (input → expected output)</label>
        {cases.map((tc, i) => (
          <div key={i} className="rounded-lg border border-border p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted">Case {i + 1}</span>
              <button
                type="button"
                disabled={cases.length <= 1}
                onClick={() => onChange({ ...payload, test_cases: cases.filter((_, j) => j !== i) })}
                className="flex size-7 items-center justify-center rounded-md text-faint transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-30"
                aria-label={`Remove test case ${i + 1}`}
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Input</label>
                <textarea
                  value={tc.input}
                  onChange={(e) => {
                    const next = cases.map((c, j) => (j === i ? { ...c, input: e.target.value } : c))
                    onChange({ ...payload, test_cases: next })
                  }}
                  rows={2}
                  spellCheck={false}
                  className={monoCls}
                />
              </div>
              <div>
                <label className={labelCls}>Expected output</label>
                <textarea
                  value={tc.expected_output}
                  onChange={(e) => {
                    const next = cases.map((c, j) => (j === i ? { ...c, expected_output: e.target.value } : c))
                    onChange({ ...payload, test_cases: next })
                  }}
                  rows={2}
                  spellCheck={false}
                  className={monoCls}
                />
              </div>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange({ ...payload, test_cases: [...cases, { input: "", expected_output: "" }] })}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted transition-colors hover:bg-surface-secondary hover:text-ink"
        >
          <Plus className="size-3.5" /> Add test case
        </button>
      </div>
    </div>
  )
}

// ---------- SQL ----------

export function SqlEditor({
  payload,
  onChange,
}: {
  payload: Record<string, unknown>
  onChange: (payload: Record<string, unknown>) => void
}) {
  const schema = typeof (payload.schema_ddl ?? payload.schema) === "string"
    ? String(payload.schema_ddl ?? payload.schema)
    : ""
  const query = typeof (payload.expected_query ?? payload.expected_sql) === "string"
    ? String(payload.expected_query ?? payload.expected_sql)
    : ""
  const result = typeof payload.expected_result === "string" ? payload.expected_result : ""

  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Database schema (DDL or description)</label>
        <textarea
          value={schema}
          onChange={(e) => onChange({ ...payload, schema_ddl: e.target.value })}
          rows={4}
          spellCheck={false}
          placeholder="CREATE TABLE employees (id INT PRIMARY KEY, name TEXT, salary NUMERIC);"
          className={monoCls}
        />
      </div>
      <div>
        <label className={labelCls}>Expected query (reference solution)</label>
        <textarea
          value={query}
          onChange={(e) => onChange({ ...payload, expected_query: e.target.value })}
          rows={3}
          spellCheck={false}
          placeholder="SELECT ... ;"
          className={monoCls}
        />
      </div>
      <div>
        <label className={labelCls}>Expected result preview (optional if query given)</label>
        <textarea
          value={result}
          onChange={(e) => onChange({ ...payload, expected_result: e.target.value })}
          rows={2}
          spellCheck={false}
          placeholder="e.g. 3 rows: (1, Ada, 90000), ..."
          className={monoCls}
        />
      </div>
    </div>
  )
}

// ---------- Subjective ----------

export function SubjectiveEditor({
  payload,
  onChange,
}: {
  payload: Record<string, unknown>
  onChange: (payload: Record<string, unknown>) => void
}) {
  const rubric = typeof payload.rubric === "string" ? payload.rubric : ""
  return (
    <div>
      <label className={labelCls}>Evaluation criteria / rubric</label>
      <textarea
        value={rubric}
        onChange={(e) => onChange({ ...payload, rubric: e.target.value })}
        rows={5}
        placeholder={"e.g.\n- Mentions consistency vs availability trade-off (3 pts)\n- Gives a real-world example (2 pts)"}
        className={textareaCls}
      />
    </div>
  )
}

export const QUESTION_TYPE_LABELS: Record<AssessmentQuestionType, string> = {
  mcq: "Multiple choice",
  coding: "Coding",
  sql: "SQL",
  subjective: "Subjective",
}
