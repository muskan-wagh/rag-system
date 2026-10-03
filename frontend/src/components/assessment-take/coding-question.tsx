"use client"

import { useState } from "react"
import { CodingEditor } from "./coding-editor"
import { CodeOutput } from "./code-output"
import { TestCaseResults } from "./test-case-results"
import { candidateApi, type RunCodeResult } from "@/lib/candidate-api"

/**
 * Coding question: Monaco + starter/reset + Run (visible only) + autosaved code.
 * Submit happens at assessment level; hidden scoring is server-side only.
 */
export function CodingQuestion({
  attemptId,
  questionId,
  starterCode,
  language = "javascript",
  initialCode,
  onCodeChange,
  disabled = false,
}: {
  attemptId: string;
  questionId: string;
  starterCode: string;
  language?: string;
  initialCode?: string;
  onCodeChange?: (code: string) => void;
  disabled?: boolean;
}) {
  const [code, setCode] = useState(initialCode || starterCode || "// Write your solution here\n");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunCodeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleChange(v: string) {
    setCode(v);
    onCodeChange?.(v);
  }

  async function handleRun() {
    setRunning(true);
    setError(null);
    try {
      const out = await candidateApi.runCode(attemptId, {
        questionId,
        language,
        sourceCode: code,
      });
      setResult(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-3" data-testid="coding-question">
      <CodingEditor value={code} onChange={handleChange} language={language} readOnly={disabled} />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || running}
          onClick={handleRun}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {running ? "Running…" : "Run Code"}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleChange(starterCode || "")}
          className="rounded-md border border-border px-4 py-2 text-sm"
        >
          Reset code
        </button>
        <span className="self-center text-xs text-muted-foreground">Run uses visible tests only.</span>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
      {result ? (
        <div className="space-y-2">
          <CodeOutput
            stdout={result.stdout}
            stderr={result.stderr}
            executionTimeMs={result.executionTimeMs}
            provider={result.provider}
            isMock={result.isMock}
          />
          <TestCaseResults results={result.testResults} />
        </div>
      ) : null}
    </div>
  );
}
