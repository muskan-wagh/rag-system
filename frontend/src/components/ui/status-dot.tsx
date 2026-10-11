import { stageDotClass } from "@/lib/pipeline"
import { cn } from "@/lib/utils"

/**
 * Status dot driven by the shared pipeline tone map. Replaces a hardcoded
 * hex lookup that ignored the active light/dark theme.
 */
export function StatusDot({ status, className }: { status?: string; className?: string }) {
  return (
    <span
      className={cn("inline-block size-1.5 shrink-0 rounded-full", stageDotClass(status), className)}
      aria-hidden
    />
  )
}
