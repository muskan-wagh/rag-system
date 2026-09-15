"use client"

interface StatusDotProps {
  status?: string
}

export function StatusDot({ status = "applied" }: StatusDotProps) {
  const s = status.toLowerCase()
  // Interview / active interview → blue, Screening / Applied → amber,
  // Hired / Offered → green, Rejected → red, neutral → gray.
  const color =
    s === "applied" || s === "screening" || s === "shortlisted" ? "#D97706" :
    s === "interview scheduled" || s === "interview completed" || s === "interview" || s === "technical round" || s === "hr round" ? "#2563EB" :
    s === "rejected" || s === "high risk" ? "#DC2626" :
    s === "hired" || s === "offered" || s === "pending offer" ? "#16A34A" :
    "#6B6B6B"
  return (
    <span className="inline-block rounded-full shrink-0" style={{ width: 6, height: 6, backgroundColor: color }} />
  )
}
