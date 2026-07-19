"use client"

import { cn } from "@/lib/utils"

interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
}

export function GlassCard({ children, className = "", hover = true }: CardProps) {
  return (
    <div
      className={cn(
        "bg-surface border border-border rounded-xl transition-all duration-120 hover:border-border-hover",
        className
      )}
    >
      {children}
    </div>
  )
}
