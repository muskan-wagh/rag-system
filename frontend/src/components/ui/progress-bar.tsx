"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface ProgressBarProps {
  value: number
  label?: string
  showValue?: boolean
  size?: "sm" | "md"
  color?: string
  className?: string
  delay?: number
}

const sizeClasses = {
  sm: "h-1",
  md: "h-1.5",
}

export function ProgressBar({
  value,
  label,
  showValue = true,
  size = "md",
  color = "bg-[#111111]",
  className,
  delay = 0,
}: ProgressBarProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {(label || showValue) && (
        <div className="flex justify-between text-xs">
          {label && <span className="text-[#6B7280]">{label}</span>}
          {showValue && <span className="text-[#111111] font-medium tabular-nums">{Math.round(value)}%</span>}
        </div>
      )}
      <div className={cn("rounded-full bg-[#ECECEC] overflow-hidden", sizeClasses[size])}>
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${value}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay, ease: "easeOut" }}
          className={cn("h-full rounded-full", color)}
        />
      </div>
    </div>
  )
}
