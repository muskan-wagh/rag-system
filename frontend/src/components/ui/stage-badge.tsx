import { cn } from "@/lib/utils"
import { stageToneClass, stageLabel, stageDotClass, stageTone } from "@/lib/pipeline"

/**
 * The single badge used for every hiring stage across the product.
 * Colour comes from `lib/pipeline` so light and dark mode always agree.
 */
export function StageBadge({
  stage,
  className,
  showDot = false,
  size = "md",
}: {
  stage?: string | null
  className?: string
  showDot?: boolean
  size?: "sm" | "md"
}) {
  return (
    <span
      data-slot="stage-badge"
      data-stage={stage ?? "unknown"}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border font-medium",
        size === "sm" ? "h-[20px] px-2 text-[11px]" : "h-[22px] px-2.5 text-[11.5px]",
        stageToneClass(stage),
        className,
      )}
    >
      {showDot && <span className={cn("size-1.5 shrink-0 rounded-full", stageDotClass(stage))} aria-hidden />}
      {stageLabel(stage)}
    </span>
  )
}

/** Bare status dot for dense rows where a full badge would be too heavy. */
export function StageDot({ stage, className }: { stage?: string | null; className?: string }) {
  const tone = stageTone(stage)
  return (
    <span
      className={cn(
        "inline-block size-1.5 shrink-0 rounded-full",
        stageDotClass(stage),
        tone === "neutral" && "ring-1 ring-inset ring-border",
        className,
      )}
      title={stageLabel(stage)}
      aria-label={stageLabel(stage)}
      role="img"
    />
  )
}
