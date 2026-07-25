"use client"

interface StatusDotProps {
  status?: string
}

export function StatusDot({ status = "applied" }: StatusDotProps) {
  const s = status.toLowerCase()
  const color =
    s === "applied" ? "#9CA3AF" :
    s === "screening" || s === "interview scheduled" || s === "interview completed" || s === "technical round" || s === "hr round" ? "#1E40AF" :
    s === "rejected" || s === "high risk" ? "#DC2626" :
    s === "hired" ? "#16A34A" :
    s === "offered" || s === "pending offer" ? "#D97706" :
    "#6B6B6B"
  return (
    <span className="inline-block rounded-full shrink-0" style={{ width: 6, height: 6, backgroundColor: color }} />
  )
}
