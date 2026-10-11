"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface ScoreRingProps {
  /** 0–1 fraction. */
  value: number
  size?: number
  strokeWidth?: number
  className?: string
  label?: string
  delay?: number
  /** Any CSS colour. Defaults to the theme's ink so it works in both modes. */
  color?: string
  trackColor?: string
}

/**
 * Donut gauge for match scores. `value` is a 0–1 fraction (the API returns
 * ratios); the ring renders the rounded percentage.
 */
export function ScoreRing({
  value,
  size = 56,
  strokeWidth = 2.5,
  className,
  label,
  delay = 0,
  color = "var(--ink)",
  trackColor = "var(--track)",
}: ScoreRingProps) {
  const cx = 18
  const cy = 18
  const r = 15.5
  const circumference = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
  const dashOffset = circumference * (1 - clamped)
  const percent = Math.round(clamped * 100)

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} viewBox="0 0 36 36" className="-rotate-90" aria-hidden>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
          <motion.circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>
        <span
          className="absolute font-data font-medium tabular-nums text-ink"
          style={{ fontSize: Math.max(10, Math.round(size * 0.27)) }}
        >
          {percent}
          <span className="text-[0.7em] text-muted">%</span>
        </span>
        <span className="sr-only">{percent}% match</span>
      </div>
      {label && <span className="text-[10.5px] text-muted">{label}</span>}
    </div>
  )
}
