"use client"

import { useEffect } from "react"
import Link from "next/link"
import { RotateCcw, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Route-level error boundary. Anything thrown while rendering a screen lands
 * here instead of showing the browser's blank page, and the user always has a
 * way back into the workspace.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Route error:", error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-center shadow-xs sm:p-8">
        <span className="mx-auto flex size-11 items-center justify-center rounded-xl border border-danger/25 bg-danger/10 text-danger">
          <TriangleAlert className="size-5" strokeWidth={1.75} aria-hidden />
        </span>

        <h1 className="mt-5 text-[18px] font-medium tracking-tight text-ink">
          This screen didn&rsquo;t load
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-muted">
          Something failed while fetching your data. Retrying usually clears it — if it
          keeps happening, the reference below identifies the failing request.
        </p>

        {error.digest && (
          <p className="mx-auto mt-4 inline-block rounded-md border border-border bg-canvas px-2.5 py-1 font-data text-[11px] text-muted">
            ref: {error.digest}
          </p>
        )}

        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button variant="action" onClick={reset}>
            <RotateCcw />
            Try again
          </Button>
          <Button variant="outline" render={<Link href="/dashboard" />}>
            Back to dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}
