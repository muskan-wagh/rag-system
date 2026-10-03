"use client"

import Editor from "@monaco-editor/react"

/**
 * Reusable Monaco coding editor (no API key required).
 * JavaScript initially; `language` prop allows future languages.
 */

export function CodingEditor({
  value,
  onChange,
  language = "javascript",
  height = 320,
  readOnly = false,
}: {
  value: string;
  onChange?: (v: string) => void;
  language?: string;
  height?: number | string;
  readOnly?: boolean;
}) {
  // Theme follows the document class set by ThemeSync; default to light.
  const isDark =
    typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  return (
    <div className="overflow-hidden rounded-lg border border-border" data-testid="coding-editor">
      <Editor
        height={height}
        language={language}
        value={value}
        theme={isDark ? "vs-dark" : "light"}
        onChange={(v) => onChange?.(v ?? "")}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 14,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          padding: { top: 12 },
        }}
        loading={<div className="p-4 text-sm text-muted-foreground">Loading editor…</div>}
      />
    </div>
  );
}
