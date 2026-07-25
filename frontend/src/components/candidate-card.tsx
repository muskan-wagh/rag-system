"use client"

import { memo, useState } from "react"
import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { ProgressBar } from "@/components/ui/progress-bar"
import { ScoreRing } from "@/components/ui/score-ring"
import { Bookmark, GitCompare, Eye, ChevronDown, ChevronUp, Plus, ExternalLink } from "lucide-react"
import Link from "next/link"
import { ROUTES, getInitials } from "@/lib/constants"
import type { RankingResult } from "@/lib/api"
import { Button } from "@/components/ui/button"

function scoreLabel(score: number) {
  if (score >= 0.8) return "Excellent"
  if (score >= 0.6) return "Strong"
  if (score >= 0.4) return "Good"
  return "Fair"
}

function scoreColor(score: number) {
  if (score >= 0.8) return "bg-ink"
  return "bg-ink-hover"
}

interface CandidateCardProps {
  result: RankingResult
  index: number
  variant?: "detailed" | "recommendation"
  jdSkills?: string[]
  onAddToPool?: (candidateId: string, name: string) => void
}

export const CandidateCard = memo(function CandidateCard({
  result,
  index,
  variant = "detailed",
  jdSkills = [],
  onAddToPool,
}: CandidateCardProps) {
  const { candidate, scores } = result
  const [expanded, setExpanded] = useState(false)

  if (variant === "recommendation") {
    const subScores: [string, number, string][] = [
      ["Skill Match", scores.skill * 100, "#111111"],
      ["Experience", scores.experience * 100, "#2563EB"],
      ["Education", scores.education * 100, "#D97706"],
    ]
    const matchedSkills = candidate.skills.filter(s => jdSkills.includes(s))
    const unmatchedSkills = candidate.skills.filter(s => !jdSkills.includes(s))

    function ringColor(v: number): string {
      if (v >= 0.8) return "#059669"
      if (v >= 0.6) return "#2563EB"
      if (v >= 0.4) return "#D97706"
      return "#DC2626"
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: index * 0.04 }}
      >
        <div className="bg-surface border border-border rounded-xl hover:border-border-hover transition-all duration-120 p-5 h-full flex flex-col">
          <div className="flex items-start gap-4">
            <ScoreRing value={scores.overall} size={56} color={ringColor(scores.overall)} />
            <div className="flex-1 min-w-0">
              <Link href={ROUTES.candidateDetail(candidate.id)} className="hover:underline">
                <h3 className="font-medium text-ink text-[15px]">{candidate.name}</h3>
              </Link>
              <div className="flex items-center gap-2 text-xs text-faint mt-0.5">
                <span className="font-data text-muted">{candidate.experience}y exp</span>
                {candidate.education?.level && (
                  <>
                    <span className="text-border">|</span>
                    <span className="capitalize">{candidate.education.level}{candidate.education.field ? `, ${candidate.education.field}` : ""}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {candidate.summary && (
            <p className="text-xs text-muted leading-relaxed mt-3 line-clamp-2">{candidate.summary}</p>
          )}

          <div className="mt-3 space-y-1.5">
            {subScores.map(([label, value, color], i) => (
              <ProgressBar key={label} value={value} label={label} size="sm" color={color} delay={0.2 + i * 0.05} />
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-1">
            {matchedSkills.slice(0, 4).map(skill => (
              <Badge key={skill} variant="success" className="text-[10px]">{skill}</Badge>
            ))}
            {unmatchedSkills.slice(0, 4 - matchedSkills.slice(0, 4).length).map(skill => (
              <Badge key={skill} variant="secondary" className="text-[10px]">{skill}</Badge>
            ))}
            {candidate.skills.length > 4 && (
              <Badge variant="outline" className="text-[10px]">+{candidate.skills.length - 4}</Badge>
            )}
          </div>

          {result.explanation && (
            <div className="mt-3">
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-[11px] font-medium text-muted hover:text-ink transition-colors"
              >
                {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                AI Reasoning
              </button>
              {expanded && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="text-[11px] text-faint leading-relaxed mt-1.5"
                >
                  {result.explanation}
                </motion.p>
              )}
            </div>
          )}

          <div className="mt-auto pt-3 flex items-center gap-2">
            <Link href={ROUTES.candidateDetail(candidate.id)}>
              <Button size="xs" variant="outline">
                <ExternalLink className="size-3" />
                View
              </Button>
            </Link>
            {onAddToPool && (
              <Button size="xs" variant="ghost" onClick={() => onAddToPool(candidate.id, candidate.name)}>
                <Plus className="size-3" />
                Pool
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.04 }}
    >
      <div className="group bg-surface border border-border rounded-xl hover:border-border-hover transition-all duration-120 p-6">
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <div className="flex size-11 items-center justify-center rounded-full bg-[#E5E7EB]">
              <span className="text-sm font-medium text-muted">
                {getInitials(candidate.name)}
              </span>
            </div>
            <div className="absolute -top-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-ink text-[9px] font-medium text-white">
              {index + 1}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Link href={ROUTES.candidateDetail(candidate.id)} className="hover:underline">
                <h3 className="font-medium text-ink text-[15px]">{candidate.name}</h3>
              </Link>
              <div className={`rounded-md px-2 py-0.5 text-[10px] font-medium text-white ${scoreColor(scores.overall)}`}>
                {scoreLabel(scores.overall)}
              </div>
            </div>
            <p className="text-[13px] text-muted line-clamp-1 mb-2">
              {candidate.summary}
            </p>
            <div className="flex items-center gap-3 text-xs text-faint mb-3">
              <span className="font-data text-muted">{candidate.experience}y</span>
              <span className="text-border">|</span>
              <span className="capitalize">{candidate.education?.level ?? "N/A"}{candidate.education?.field ? ` in ${candidate.education.field}` : ""}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {candidate.skills.slice(0, 5).map((skill) => (
                <Badge key={skill} variant="secondary" className="text-[11px] font-normal">
                  {skill}
                </Badge>
              ))}
              {candidate.skills.length > 5 && (
                <Badge variant="outline" className="text-[11px] font-normal">
                  +{candidate.skills.length - 5}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center gap-1 shrink-0">
            <span className="font-data text-[28px] font-medium text-ink leading-none">
              {Math.round(scores.overall * 100)}%
            </span>
            <span className="text-[11px] text-faint uppercase" style={{ letterSpacing: "0.04em" }}>Match</span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <div className="grid grid-cols-4 gap-3">
            <ProgressBar value={scores.skill * 100} label="Skills" size="sm" color="bg-info" delay={0.3} />
            <ProgressBar value={scores.experience * 100} label="Experience" size="sm" color="bg-info/70" delay={0.35} />
            <ProgressBar value={scores.education * 100} label="Education" size="sm" color="bg-muted" delay={0.4} />
            <ProgressBar value={scores.overall * 100} label="Overall" size="sm" color="bg-info" delay={0.45} />
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
          <p className="text-xs text-faint leading-relaxed line-clamp-1 flex-1 mr-4">
            <span className="font-medium text-ink">AI:</span> {result.explanation}
          </p>
          <div className="flex items-center gap-1">
            <Link href={ROUTES.candidateDetail(candidate.id)}>
              <button className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-[#F3F4F6] transition-colors duration-120 text-faint hover:text-ink">
                <Eye className="size-[14px]" strokeWidth={1.5} />
              </button>
            </Link>
            <button className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-[#F3F4F6] transition-colors duration-120 text-faint hover:text-ink">
              <GitCompare className="size-[14px]" strokeWidth={1.5} />
            </button>
            <button className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-[#F3F4F6] transition-colors duration-120 text-faint hover:text-ink">
              <Bookmark className="size-[14px]" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
})
