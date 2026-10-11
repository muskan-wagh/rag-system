import { cn } from "@/lib/utils"

/**
 * HireStack brand mark — a hiring funnel: three stacked rails narrowing as
 * candidates progress. Encodes the product's core idea (structured pipeline,
 * no skipped stages) and stays legible down to 20px.
 *
 * Uses only theme tokens so it flips correctly in light and dark mode.
 */
export function BrandGlyph({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <rect x="1" y="1.75" width="14" height="3" rx="1.5" fill="currentColor" opacity="1" />
      <rect x="3.5" y="6.5" width="9" height="3" rx="1.5" fill="currentColor" opacity="0.66" />
      <rect x="6" y="11.25" width="4" height="3" rx="1.5" fill="currentColor" opacity="0.38" />
    </svg>
  )
}

export function BrandMark({
  size = 28,
  className,
  variant = "solid",
}: {
  size?: number
  className?: string
  variant?: "solid" | "soft"
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[8px] transition-colors",
        variant === "solid"
          ? "bg-primary-solid text-primary-solid-text"
          : "bg-accent-soft text-accent ring-1 ring-inset ring-accent-border",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <BrandGlyph size={Math.round(size * 0.55)} />
    </span>
  )
}

export function BrandLogo({
  compact = false,
  size = 28,
  className,
}: {
  compact?: boolean
  size?: number
  className?: string
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BrandMark size={size} />
      {!compact && (
        <span className="text-[15px] font-medium tracking-[-0.01em] text-ink">
          HireStack
        </span>
      )}
    </span>
  )
}
