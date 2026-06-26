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
  color = "bg-primary",
  className,
  delay = 0,
}: ProgressBarProps) {
  return (
    <div className={cn("space-y-1", className)}>
      {(label || showValue) && (
        <div className="flex justify-between text-xs">
          {label && <span className="text-muted-foreground">{label}</span>}
          {showValue && <span className="text-foreground/70 font-medium">{Math.round(value)}%</span>}
        </div>
      )}
      <div className={cn("rounded-full bg-muted overflow-hidden", sizeClasses[size])}>
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
