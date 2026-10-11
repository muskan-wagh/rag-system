"use client"

import Link from "next/link"
import { useUser } from "@clerk/nextjs"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface KpiProps {
  label: string
  value: number | string
  icon: LucideIcon
  href: string
  /** Filled portion of the micro-bar, 0–1. */
  fill?: number
  caption: string
  tone?: "accent" | "info" | "success" | "warning" | "neutral"
}

const TONE: Record<string, { chip: string; bar: string; ring: string }> = {
  accent: { chip: "bg-accent-soft text-accent", bar: "bg-accent", ring: "hover:border-accent-border" },
  info: { chip: "bg-info/10 text-info", bar: "bg-info", ring: "hover:border-info/30" },
  success: { chip: "bg-success/10 text-success", bar: "bg-success", ring: "hover:border-success/30" },
  warning: { chip: "bg-warning/10 text-warning", bar: "bg-warning", ring: "hover:border-warning/30" },
  neutral: { chip: "bg-surface-secondary text-ink", bar: "bg-ink", ring: "hover:border-border-hover" },
}

/**
 * KPI card. The whole tile is a link into the matching filtered view, the
 * micro-bar shows share-of-pipeline at a glance, and the value uses the mono
 * face so columns of digits line up.
 */
export function KpiCard({ label, value, icon: Icon, href, fill, caption, tone = "neutral" }: KpiProps) {
  const t = TONE[tone]
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-border bg-surface p-4",
        "shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        t.ring,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
          {label}
        </span>
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105",
            t.chip,
          )}
        >
          <Icon className="size-3.5" strokeWidth={1.75} aria-hidden />
        </span>
      </div>

      <p className="mt-2.5 font-data text-[28px] font-medium leading-none tracking-tight text-ink">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>

      <p className="mt-1.5 truncate text-[11.5px] text-muted">{caption}</p>

      <div className="mt-3 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-track">
          <div
            className={cn("h-full rounded-full transition-[width] duration-700 ease-out", t.bar)}
            style={{ width: `${Math.max(0, Math.min(100, (fill ?? 0) * 100))}%` }}
          />
        </div>
        <span
          className="shrink-0 text-[11px] font-medium opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          aria-hidden
        >
          <svg viewBox="0 0 12 12" className="size-3 text-faint">
            <path d="M4 2.5 7.5 6 4 9.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
    </Link>
  )
}

/** Time-aware greeting so the workspace feels like it knows when you arrived. */
export function greeting(): string {
  const h = typeof window === "undefined" ? 12 : new Date().getHours()
  if (h < 5) return "Working late"
  if (h < 12) return "Good morning"
  if (h < 18) return "Good afternoon"
  return "Good evening"
}

export function useGreeting() {
  const { user } = useUser()
  const name = user?.firstName || user?.fullName?.split(" ")[0] || "there"
  return { greeting: greeting(), name }
}
