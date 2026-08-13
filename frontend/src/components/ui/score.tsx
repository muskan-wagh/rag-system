export function getScoreColor(value: number): string {
  if (value >= 80) return "#15803D"
  if (value >= 60) return "#1D4ED8"
  if (value >= 40) return "#B45309"
  return "#D5342C"
}

export function getScoreLabel(value?: number): string {
  if (value === undefined || value === null) return "—"
  if (value >= 80) return "Excellent"
  if (value >= 60) return "Strong"
  if (value >= 40) return "Fair"
  return "Low"
}

interface MatchScoreProps {
  value?: number
  showLabel?: boolean
  className?: string
}

export function MatchScore({ value, showLabel = false, className }: MatchScoreProps) {
  const v = value ?? 0
  const color = getScoreColor(v)
  return (
    <div className={`flex flex-col items-start gap-1 ${className ?? ""}`}>
      <span className="font-data text-[13px] font-medium leading-none" style={{ color }}>
        {value !== undefined && value !== null ? `${Math.round(value)}%` : "—"}
      </span>
      {showLabel && <span className="text-[10px] text-faint">{getScoreLabel(value)}</span>}
    </div>
  )
}

interface ScoreBarProps {
  value?: number
  className?: string
}

export function ScoreBar({ value, className }: ScoreBarProps) {
  const v = value ?? 0
  return (
    <div className={`h-1 w-14 rounded-full bg-track overflow-hidden ${className ?? ""}`}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.min(v, 100)}%`, backgroundColor: getScoreColor(v) }}
      />
    </div>
  )
}
