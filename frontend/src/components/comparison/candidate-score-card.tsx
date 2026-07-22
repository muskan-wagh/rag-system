"use client"

import { motion } from "framer-motion"
import { ScoreRing } from "@/components/ui/score-ring"
import { ProgressBar } from "@/components/ui/progress-bar"
import { Badge } from "@/components/ui/badge"
import type { ComparisonCandidate } from "@/lib/api"
import { cn } from "@/lib/utils"

interface CandidateScoreCardProps {
  candidate: ComparisonCandidate
  index: number
  total: number
}

function scoreColor(value: number): string {
  if (value >= 85) return "#059669"
  if (value >= 70) return "#2563EB"
  if (value >= 50) return "#D97706"
  return "#DC2626"
}

function scoreLabel(value: number): string {
  if (value >= 85) return "Strong"
  if (value >= 70) return "Good"
  if (value >= 50) return "Fair"
  return "Weak"
}

const SCORE_DIMENSIONS = [
  { key: "technical" as const, label: "Technical" },
  { key: "experience" as const, label: "Experience" },
  { key: "education" as const, label: "Education" },
  { key: "culture" as const, label: "Culture" },
  { key: "leadership" as const, label: "Leadership" },
  { key: "communication" as const, label: "Communication" },
]

export function CandidateScoreCard({ candidate, index, total }: CandidateScoreCardProps) {
  const color = scoreColor(candidate.scores.overall)
  const bgColor = color + "15"

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1, ease: [0.25, 0.1, 0.25, 1] }}
      className={cn(
        "flex-1 min-w-0 bg-white rounded-2xl border border-border p-5",
        candidate.scores.overall >= 85 && "ring-1 ring-success/20",
      )}
    >
      <div className="flex items-start gap-4 mb-5">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-base font-semibold"
          style={{ backgroundColor: bgColor, color }}
        >
          {candidate.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-medium text-ink truncate">{candidate.name}</h3>
          {candidate.title && (
            <p className="text-xs text-muted truncate">
              {candidate.title}{candidate.company ? ` @ ${candidate.company}` : ""}
            </p>
          )}
          <p className="text-[11px] text-muted mt-0.5">
            {candidate.experience} yrs exp &middot; {candidate.skills.length} skills
          </p>
        </div>
        <ScoreRing value={candidate.scores.overall / 100} size={56} color={color} label="Overall" delay={index * 0.1} />
      </div>

      <div className="space-y-2 mb-4">
        {SCORE_DIMENSIONS.map((dim, i) => (
          <ProgressBar
            key={dim.key}
            value={candidate.scores[dim.key]}
            label={dim.label}
            color={cn(
              candidate.scores[dim.key] >= 85 ? "bg-success" :
              candidate.scores[dim.key] >= 70 ? "bg-blue-500" :
              candidate.scores[dim.key] >= 50 ? "bg-amber-500" : "bg-danger"
            )}
            size="sm"
            delay={index * 0.1 + (i + 1) * 0.05}
          />
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={candidate.scores.overall >= 70 ? "success" : candidate.scores.overall >= 50 ? "warning" : "destructive"}>
          {scoreLabel(candidate.scores.overall)}
        </Badge>
        {candidate.scores.overall === Math.max(...Array.from({ length: total }, (_, i) =>
          i === index ? candidate.scores.overall : 0
        )) && (
          <Badge variant="success">Top match</Badge>
        )}
      </div>
    </motion.div>
  )
}
