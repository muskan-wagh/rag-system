import { Loader2 } from "lucide-react"

/** Route-level pending state. Mirrors the app shell so the page doesn't jump. */
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="size-5 animate-spin text-muted" strokeWidth={1.75} aria-hidden />
        <p className="text-[13px] text-muted">Loading…</p>
      </div>
    </div>
  )
}
