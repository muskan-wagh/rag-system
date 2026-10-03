"use client"

/** Safe code output console — stdout/stderr only, never hidden data. */
export function CodeOutput({
  stdout,
  stderr,
  executionTimeMs,
  provider,
  isMock,
}: {
  stdout: string;
  stderr: string;
  executionTimeMs?: number | null;
  provider?: string;
  isMock?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/40" data-testid="code-output">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5 text-xs text-muted-foreground">
        <span>Output / console</span>
        <span className="tabular-nums">
          {typeof executionTimeMs === "number" ? `${executionTimeMs}ms` : ""}
          {provider ? ` · ${provider}${isMock ? " (mock)" : ""}` : ""}
        </span>
      </div>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap p-3 font-mono text-xs">
        {stdout || <span className="text-muted-foreground">(no stdout)</span>}
        {stderr ? `\n--- stderr ---\n${stderr}` : ""}
      </pre>
      {isMock ? (
        <p className="border-t border-border px-3 py-1.5 text-[11px] text-amber-600">
          Mock execution — Judge0 is not configured. Results are illustrative only.
        </p>
      ) : null}
    </div>
  );
}
