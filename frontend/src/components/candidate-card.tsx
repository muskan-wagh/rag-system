"use client"

import { memo, useState } from "react"
import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { ProgressBar } from "@/components/ui/progress-bar"
import { ScoreRing } from "@/components/ui/score-ring"
import {
  Briefcase,
  GraduationCap,
  Sparkles,
  Eye,
  ChevronDown,
  Plus,
  Mail,
} from "lucide-react"
import { getInitials } from "@/lib/constants"
import type { RankingResult } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { GmailLogo } from "@/components/gmail-logo"
import { cn } from "@/lib/utils"

function scoreTone(score: number): "high" | "medium" | "low" | "none" {
  if (!Number.isFinite(score)) return "none"
  if (score >= 0.7) return "high"
  if (score >= 0.5) return "medium"
  return "low"
}

function ringColorFor(score: number): string {
  const tone = scoreTone(score)
  if (tone === "high") return "#16A34A"
  if (tone === "medium") return "#D97706"
  if (tone === "low") return "#DC2626"
  return "#6B7280"
}

function hasScore(score: unknown): score is number {
  return typeof score === "number" && Number.isFinite(score)
}

interface CandidateCardProps {
  result: RankingResult
  index: number
  variant?: "detailed" | "recommendation"
  jdSkills?: string[]
  onView?: (candidateId: string) => void
  onAddToPool?: (candidateId: string, name: string) => void
  onEmail?: (candidateId: string, name: string) => void
}

export const CandidateCard = memo(function CandidateCard({
  result,
  index,
  variant = "detailed",
  jdSkills = [],
  onView,
  onAddToPool,
  onEmail,
}: CandidateCardProps) {
  const { candidate, scores } = result
  const [expanded, setExpanded] = useState(false)

  const overall = scores?.overall
  const overallValid = hasScore(overall)
  const overallPct = overallValid ? Math.round(overall * 100) : null

  const skillScore = hasScore(scores?.skill) ? scores.skill : null
  const expScore = hasScore(scores?.experience) ? scores.experience : null
  const eduScore = hasScore(scores?.education) ? scores.education : null

  const matchedSkills =
    jdSkills.length > 0
      ? candidate.skills.filter((s) =>
          jdSkills.map((j) => j.toLowerCase()).includes(s.toLowerCase()),
        )
      : []
  const unmatchedSkills =
    jdSkills.length > 0
      ? candidate.skills.filter(
          (s) => !jdSkills.map((j) => j.toLowerCase()).includes(s.toLowerCase()),
        )
      : candidate.skills

  const visibleMatched = matchedSkills.slice(0, 4)
  const remainingSlots = Math.max(0, 4 - visibleMatched.length)
  const visibleUnmatched = unmatchedSkills.slice(0, remainingSlots)
  const hiddenCount = candidate.skills.length - visibleMatched.length - visibleUnmatched.length

  const showDetailedBars = variant === "detailed"

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.3) }}
      className="h-full"
    >
      <div className="flex h-full flex-col rounded-xl border border-border bg-surface p-4 transition-all duration-150 hover:border-border-hover hover:shadow-[0_8px_28px_rgba(0,0,0,0.28)] sm:p-5">
        {/* Header: avatar + name + score */}
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-soft ring-1 ring-border">
            <span className="text-[13px] font-semibold text-muted">
              {getInitials(candidate.name)}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="truncate text-[15px] font-semibold leading-tight text-ink">
                {candidate.name}
              </h3>
              {overallValid ? (
                <span
                  className={cn(
                    "shrink-0 rounded-md px-1.5 py-0.5 font-data text-[13px] font-semibold tabular-nums",
                    scoreTone(overall) === "high" && "text-success",
                    scoreTone(overall) === "medium" && "text-warning",
                    scoreTone(overall) === "low" && "text-danger",
                  )}
                >
                  {overallPct}%
                </span>
              ) : (
                <span className="shrink-0 rounded-md bg-surface-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted">
                  —
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted">
              <span className="inline-flex items-center gap-1">
                <Briefcase className="size-3" strokeWidth={1.75} />
                {candidate.experience}y exp
              </span>
              {candidate.education?.level && (
                <span className="inline-flex min-w-0 items-center gap-1">
                  <GraduationCap className="size-3 shrink-0" strokeWidth={1.75} />
                  <span className="truncate capitalize">
                    {candidate.education.level}
                    {candidate.education.field ? ` · ${candidate.education.field}` : ""}
                  </span>
                </span>
              )}
            </div>
          </div>
          <div className="shrink-0">
            {overallValid ? (
              <ScoreRing value={overall} size={52} color={ringColorFor(overall)} />
            ) : (
              <div
                className="flex items-center justify-center rounded-full border border-border text-[11px] font-medium text-muted"
                style={{ width: 52, height: 52 }}
              >
                —
              </div>
            )}
          </div>
        </div>

        {/* Skills */}
        {candidate.skills.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {visibleMatched.map((skill) => (
              <Badge key={`m-${skill}`} variant="success" className="text-[11px]">
                {skill}
              </Badge>
            ))}
            {visibleUnmatched.map((skill) => (
              <Badge key={`u-${skill}`} variant="secondary" className="text-[11px] font-normal">
                {skill}
              </Badge>
            ))}
            {hiddenCount > 0 && (
              <Badge variant="outline" className="text-[11px] font-normal">
                +{hiddenCount}
              </Badge>
            )}
          </div>
        ) : (
          <p className="mt-3 text-[12px] text-faint">No skills listed</p>
        )}

        {/* Score bars — real scores only */}
        <div className="mt-3 space-y-2">
          {skillScore !== null && (
            <ProgressBar
              value={skillScore * 100}
              label="Skill Match"
              size="sm"
              color={scoreTone(skillScore) === "high" ? "bg-success" : scoreTone(skillScore) === "medium" ? "bg-warning" : "bg-danger"}
              delay={0.15}
            />
          )}
          {expScore !== null && (
            <ProgressBar
              value={expScore * 100}
              label="Experience"
              size="sm"
              color={scoreTone(expScore) === "high" ? "bg-success" : scoreTone(expScore) === "medium" ? "bg-warning" : "bg-danger"}
              delay={0.2}
            />
          )}
          {showDetailedBars && eduScore !== null && (
            <ProgressBar
              value={eduScore * 100}
              label="Education"
              size="sm"
              color={scoreTone(eduScore) === "high" ? "bg-success" : scoreTone(eduScore) === "medium" ? "bg-warning" : "bg-danger"}
              delay={0.25}
            />
          )}
        </div>

        {/* AI reasoning — real explanation only */}
        {result.explanation ? (
          <div className="mt-3 rounded-lg border border-border bg-surface-secondary/40 p-2.5">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setExpanded((v) => !v)
              }}
              className="flex w-full items-center gap-1.5 text-left text-[11px] font-medium text-muted transition-colors hover:text-ink"
              aria-expanded={expanded}
            >
              <Sparkles className="size-3 shrink-0 text-warning" strokeWidth={1.75} />
              <span className="flex-1">AI reasoning</span>
              <ChevronDown
                className={cn("size-3 transition-transform", expanded && "rotate-180")}
                strokeWidth={1.75}
              />
            </button>
            <p
              className={cn(
                "mt-1 text-[12px] leading-relaxed text-muted",
                !expanded && "line-clamp-2",
              )}
            >
              {result.explanation}
            </p>
          </div>
        ) : null}

        {/* Actions */}
        <div className="mt-auto flex items-center gap-1.5 pt-3">
          <Button
            size="xs"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation()
              if (onView) onView(candidate.id)
            }}
            className="h-8 flex-1 text-[12px] sm:flex-none sm:px-3.5"
          >
            <Eye className="size-3.5" strokeWidth={1.75} />
            View Profile
          </Button>
          {onAddToPool && (
            <Button
              size="xs"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation()
                onAddToPool(candidate.id, candidate.name)
              }}
              className="h-8 text-[12px]"
            >
              <Plus className="size-3.5" strokeWidth={1.75} />
              Pool
            </Button>
          )}
          {onEmail && (
            <Button
              size="xs"
              variant="ghost"
              disabled={!candidate.email}
              title={
                candidate.email
                  ? `Send outreach to ${candidate.name}`
                  : "No email on file for this candidate"
              }
              onClick={(e) => {
                e.stopPropagation()
                onEmail(candidate.id, candidate.name)
              }}
              className="h-8 text-[12px]"
            >
              {candidate.email ? (
                <GmailLogo className="size-3.5" />
              ) : (
                <Mail className="size-3.5" strokeWidth={1.75} />
              )}
              Email
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  )
})
