"use client"

import type { CandidateBriefScores } from "@/lib/types"

interface MatchScoreCardProps {
  scores: CandidateBriefScores | null
}

export function MatchScoreCard({ scores }: MatchScoreCardProps) {
  if (!scores) {
    return (
      <div className="bg-white rounded-xl border border-border p-5">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Match Score</h3>
        <p className="text-sm text-muted-foreground">Run a search with a JD to see match scores.</p>
      </div>
    )
  }

  const overallPct = Math.round(scores.overall * 100)
  const bars = [
    { label: "Semantic", value: scores.skill, color: "bg-[#1F4770]" },
    { label: "Skills", value: scores.skill, color: "bg-emerald-500" },
    { label: "Experience", value: scores.experience, color: "bg-amber-500" },
    { label: "Education", value: scores.education, color: "bg-violet-500" },
  ]

  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Match Score</h3>
        <span className="text-2xl font-bold text-[#1F4770]">{overallPct}%</span>
      </div>
      <div className="space-y-2.5">
        {bars.map((bar) => (
          <div key={bar.label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">{bar.label}</span>
              <span className="font-medium text-foreground">{Math.round(bar.value * 100)}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${bar.color}`} style={{ width: `${bar.value * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
