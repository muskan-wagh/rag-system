"use client"

/** Visible test-case results only — never expected hidden outputs. */
export function TestCaseResults({
  results,
}: {
  results: Array<{ input: string; passed: boolean | null; actual: string }>;
}) {
  if (!results || results.length === 0) {
    return <p className="text-xs text-muted-foreground">No visible test cases.</p>;
  }
  return (
    <ul className="space-y-2" data-testid="test-case-results">
      {results.map((r, i) => (
        <li key={i} className="rounded-lg border border-border p-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-medium">Test {i + 1}</span>
            {r.passed === null ? (
              <span className="text-muted-foreground">not scored (run only)</span>
            ) : r.passed ? (
              <span className="text-emerald-600">passed</span>
            ) : (
              <span className="text-red-600">failed</span>
            )}
          </div>
          <div className="mt-1 font-mono whitespace-pre-wrap break-words text-muted-foreground">
            input: {r.input || "(empty)"}
          </div>
          <div className="mt-1 font-mono whitespace-pre-wrap break-words">output: {r.actual.slice(0, 500)}</div>
        </li>
      ))}
    </ul>
  );
}
