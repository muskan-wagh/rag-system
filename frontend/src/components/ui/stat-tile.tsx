"use client"

import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

interface StatTileProps {
  label: string
  value?: number | string | null
  icon?: LucideIcon
  hint?: string
  /** When set the tile becomes a link to the matching filtered view. */
  href?: string
  /** Tokenised accent for the icon chip, e.g. "text-info bg-info/10". */
  tone?: "neutral" | "info" | "accent" | "success" | "warning" | "danger"
  loading?: boolean
  className?: string
}

const TONE_CHIP: Record<string, string> = {
  neutral: "bg-surface-secondary text-ink",
  info: "bg-info/10 text-info",
  accent: "bg-accent-soft text-accent",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
}

/**
 * KPI tile. When `href` is provided the whole tile is a link, so dashboard
 * metrics and stage cards navigate straight to the matching filtered view.
 */
export function StatTile({
  label,
  value,
  icon: Icon,
  hint,
  href,
  tone = "neutral",
  loading = false,
  className,
}: StatTileProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="text-[11.5px] font-medium uppercase tracking-[0.05em] text-muted">
          {label}
        </span>
        {Icon && (
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-lg",
              TONE_CHIP[tone],
            )}
          >
            <Icon className="size-3.5" strokeWidth={1.75} aria-hidden />
          </span>
        )}
      </div>

      <div className="mt-3">
        {loading ? (
          <Skeleton className="h-7 w-16 rounded-md" />
        ) : (
          <span className="font-data text-[26px] font-medium leading-none tracking-tight text-ink">
            {typeof value === "number" ? value.toLocaleString() : (value ?? "0")}
          </span>
        )}
      </div>

      {hint && !loading && <p className="mt-1.5 text-[11.5px] leading-tight text-muted">{hint}</p>}
    </>
  )

  const shell = cn(
    "block rounded-xl border border-border bg-surface p-4 text-left transition-all duration-150",
    href &&
      "hover:border-border-hover hover:shadow-md focus-visible:border-accent focus-visible:shadow-md",
    className,
  )

  if (href) {
    return (
      <Link href={href} className={shell}>
        {body}
        <span className="sr-only">— open filtered view</span>
      </Link>
    )
  }

  return (
    <div className={shell}>
      {body}
    </div>
  )
}
