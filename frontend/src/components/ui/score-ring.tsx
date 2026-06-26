"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface ScoreRingProps {
  value: number
  size?: number
  strokeWidth?: number
  className?: string
  label?: string
  delay?: number
  color?: string
}

export function ScoreRing({
  value,
  size = 56,
  strokeWidth = 2.5,
  className,
  label,
  delay = 0,
  color = "#2563EB",
}: ScoreRingProps) {
  const cx = 18
  const cy = 18
  const r = 15.5
  const circumference = 2 * Math.PI * r
  const dashOffset = circumference * (1 - value)

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox="0 0 36 36"
          className="-rotate-90"
        >
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="rgba(0,0,0,0.06)"
            strokeWidth={strokeWidth}
          />
          <motion.circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 1, delay, ease: "easeOut" }}
          />
        </svg>
        <span className="absolute text-sm font-bold text-foreground">
          {Math.round(value * 100)}%
        </span>
      </div>
      {label && (
        <span className="text-[10px] text-muted-foreground">{label}</span>
      )}
    </div>
  )
}
