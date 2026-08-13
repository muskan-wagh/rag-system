"use client"

import { StatusDot } from "@/components/ui/status-dot"

interface StatusBadgeProps {
  status?: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12px] text-muted ${className ?? ""}`}>
      <StatusDot status={status} />
      <span className="capitalize">{status || "Applied"}</span>
    </span>
  )
}
