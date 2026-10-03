"use client"
/* eslint-disable react-hooks/set-state-in-effect -- token exchange + data load effects set state after async fetch */

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { candidateApi, type CandidateAssessment, type SubmitResult } from "@/lib/candidate-api"
import { CodingQuestion } from "@/components/assessment-take/coding-question"
import { AssessmentTimer } from "@/components/assessment-take/assessment-timer"
import { useProctoring } from "@/components/assessment-take/use-proctoring"
import { HiringProgressTracker } from "@/components/hiring-progress-tracker"

type SaveState = "idle" | "saving" | "saved" | "error";

export default function TakeAssessmentPage() {
  const params = useParams<{ token: string }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;

  const [phase, setPhase] = useState<"loading" | "instructions" | "taking" | "submitted" | "error">("loading");
  const [data, setData] = useState<CandidateAssessment | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { answer: unknown; code?: string; language?: string }>>({});
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useProctoring(phase === "taking" ? attemptId : null);

  useEffect(() => {
    if (!token) {
      setError("Missing invitation token.");
      setPhase("error");
      return;
    }
    candidateApi
      .exchangeAssessmentToken(token)
      .then((r) => {
        setAttemptId(r.attemptId);
        setPhase("instructions");
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Invalid invitation link.");
        setPhase("error");
      });
  }, [token]);

  const load = useCallback(async () => {
    try {
      const full = await candidateApi.getAssessment();
      setData(full);
      if (full.attempt) setAttemptId(full.attempt.id);
      const restored: Record<string, { answer: unknown; code?: string; language?: string }> = {};
      for (const a of full.answers || []) {
        restored[a.question_id] = { answer: a.answer, code: undefined, language: a.language || undefined };
      }
      setAnswers(restored);
      setPhase("taking");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load assessment.");
      setPhase("error");
    }
  }, []);

  function queueAutosave(questionId: string) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");
    saveTimer.current = setTimeout(async () => {
      const id = attemptId;
      if (!id) return;
      const entry = answersRef.current[questionId];
      try {
        await candidateApi.saveAnswer(id, {
          questionId,
          answer: (entry?.answer as Record<string, unknown>) || {},
          language: entry?.language,
          code: entry?.code,
        });
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 800);
  }

  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  function setAnswer(questionId: string, patch: { answer?: unknown; code?: string; language?: string }) {
    setAnswers((prev) => ({ ...prev, [questionId]: { ...(prev[questionId] || { answer: {} }), ...patch } }));
    queueAutosave(questionId);
  }

  async function handleSubmit() {
    if (!attemptId || submitting) return;
    setSubmitting(true);
    try {
      // Flush current answer first (best-effort).
      const q = data?.questions[current];
      if (q) {
        const entry = answers[q.id];
        if (entry) {
          await candidateApi.saveAnswer(attemptId, {
            questionId: q.id,
            answer: (entry.answer as Record<string, unknown>) || {},
            language: entry.language,
            code: entry.code,
          }).catch(() => {});
        }
      }
      const out = await candidateApi.submit(attemptId);
      setResult(out);
      setPhase("submitted");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (phase === "loading") {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-sm text-muted-foreground">Validating your secure invitation…</p>
      </main>
    );
  }

  if (phase === "error") {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-xl font-semibold">Assessment unavailable</h1>
        <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>
      </main>
    );
  }

  if (phase === "instructions") {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Assessment instructions</h1>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Complete the assessment in one sitting within the shown time.</li>
          <li>Your answers autosave. Do not share your link.</li>
          <li>Coding questions: use Run to check visible cases; hidden tests run on submit.</li>
          <li>Tab switches and copy/paste are recorded as review signals.</li>
        </ul>
        <button
          onClick={load}
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
        >
          Start assessment
        </button>
      </main>
    );
  }

  if (phase === "submitted") {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Assessment submitted</h1>
        {result ? (
          <div className="rounded-lg border border-border p-4 text-sm">
            <p>Score: <strong className="tabular-nums">{result.score} / {result.maxScore} ({result.percentage}%)</strong></p>
            <p className="mt-1">{result.passed ? "You qualified. Watch your email for the technical interview invitation." : "Thanks for completing the assessment. The hiring team will review your result."}</p>
          </div>
        ) : null}
        <CandidateProgress />
      </main>
    );
  }

  const questions = data?.questions || [];
  const q = questions[current];

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">{data?.assessment.name || "Assessment"}</h1>
        <div className="flex items-center gap-2">
          <AssessmentTimer expiresAt={data?.attempt?.expires_at || null} />
          <span className="text-xs text-muted-foreground" data-testid="autosave-state">
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed — retrying" : ""}
          </span>
        </div>
      </div>

      {questions.length > 1 ? (
        <nav aria-label="Questions" className="flex flex-wrap gap-1.5">
          {questions.map((item, i) => (
            <button
              key={item.id}
              onClick={() => setCurrent(i)}
              aria-current={i === current ? "true" : undefined}
              className={`h-8 min-w-8 rounded-md border px-2 text-xs tabular-nums ${i === current ? "border-primary bg-primary/10 font-semibold" : "border-border"}`}
            >
              {i + 1}
            </button>
          ))}
        </nav>
      ) : null}

      {q ? (
        <section key={q.id} className="space-y-3 rounded-xl border border-border p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Question {current + 1} of {questions.length} · {q.type} · {q.marks} marks</span>
          </div>
          <h2 className="font-medium">{q.title || `Question ${current + 1}`}</h2>
          <p className="whitespace-pre-wrap text-sm">{q.prompt}</p>
          <QuestionBody
            question={q}
            attemptId={attemptId || ""}
            value={answers[q.id]}
            onChange={(patch) => setAnswer(q.id, patch)}
          />
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">No questions in this assessment.</p>
      )}

      <div className="flex items-center justify-between">
        <button
          disabled={current === 0}
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          className="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-50"
        >
          Previous
        </button>
        {current < questions.length - 1 ? (
          <button
            onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}
            className="rounded-md border border-border px-4 py-2 text-sm"
          >
            Next
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit assessment"}
          </button>
        )}
      </div>
    </main>
  );
}

function QuestionBody({
  question,
  attemptId,
  value,
  onChange,
}: {
  question: { id: string; type: string; payload: Record<string, unknown> };
  attemptId: string;
  value?: { answer: unknown; code?: string; language?: string };
  onChange: (patch: { answer?: unknown; code?: string; language?: string }) => void;
}) {
  if (question.type === "mcq") {
    const options = (Array.isArray(question.payload.options) ? question.payload.options : []) as Array<{ id?: string; text?: string } | string>;
    const selected = String((value?.answer as Record<string, unknown> | undefined)?.selected_option_id || "");
    return (
      <div className="space-y-2" role="radiogroup" aria-label="Options">
        {options.map((o, i) => {
          const id = typeof o === "string" ? `opt-${i + 1}` : String(o.id || `opt-${i + 1}`);
          const text = typeof o === "string" ? o : String(o.text || "");
          return (
            <label key={id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-2.5 text-sm">
              <input
                type="radio"
                name={`mcq-${question.id}`}
                checked={selected === id}
                onChange={() => onChange({ answer: { selected_option_id: id } })}
              />
              <span>{text}</span>
            </label>
          );
        })}
      </div>
    );
  }
  if (question.type === "coding") {
    const starter = String(question.payload.starter_code || "// Write your solution here\n");
    const lang = String(question.payload.language || "javascript");
    return (
      <CodingQuestion
        attemptId={attemptId}
        questionId={question.id}
        starterCode={starter}
        language={lang}
        initialCode={value?.code}
        onCodeChange={(code) => onChange({ code, language: lang, answer: { code } })}
      />
    );
  }
  if (question.type === "sql") {
    return (
      <div className="space-y-2">
        {question.payload.schema_ddl ? (
          <pre className="max-h-40 overflow-auto rounded-lg bg-muted/40 p-3 font-mono text-xs">{String(question.payload.schema_ddl)}</pre>
        ) : null}
        <textarea
          aria-label="SQL answer"
          rows={8}
          className="w-full rounded-lg border border-border bg-transparent p-3 font-mono text-sm"
          placeholder="Write your SQL query here…"
          value={String((value?.answer as Record<string, unknown> | undefined)?.query || "")}
          onChange={(e) => onChange({ answer: { query: e.target.value } })}
        />
      </div>
    );
  }
  return (
    <textarea
      aria-label="Answer"
      rows={6}
      className="w-full rounded-lg border border-border bg-transparent p-3 text-sm"
      placeholder="Write your answer here…"
      value={String((value?.answer as Record<string, unknown> | undefined)?.text || "")}
      onChange={(e) => onChange({ answer: { text: e.target.value } })}
    />
  );
}

function CandidateProgress() {
  const [stages, setStages] = useState<Array<{ stage: string; state: "completed" | "current" | "upcoming" }>>([]);
  useEffect(() => {
    candidateApi.getProgress().then((p) => setStages(p.stages as typeof stages)).catch(() => {});
  }, []);
  if (stages.length === 0) return null;
  return (
    <div className="rounded-lg border border-border p-4">
      <h2 className="mb-2 text-sm font-medium">Your progress</h2>
      <HiringProgressTracker stages={stages} variant="candidate" />
    </div>
  );
}
