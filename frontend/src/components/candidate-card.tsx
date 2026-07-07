"use client"

import { memo } from "react"
import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { ProgressBar } from "@/components/ui/progress-bar"
import { ScoreRing } from "@/components/ui/score-ring"
import { Bookmark, GitCompare, Eye, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { ROUTES } from "@/lib/constants"
import type { RankingResult } from "@/lib/api"

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function scoreLabel(score: number) {
  if (score >= 0.8) return "Excellent"
  if (score >= 0.6) return "Strong"
  if (score >= 0.4) return "Good"
  return "Fair"
}

function scoreColor(score: number) {
  if (score >= 0.8) return "bg-primary"
  if (score >= 0.6) return "bg-blue-500"
  return "bg-cyan-500"
}

export const CandidateCard = memo(function CandidateCard({ result, index }: { result: RankingResult; index: number }) {
  const { candidate, scores } = result

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.04 }}
    >
      <div className="group bg-white rounded-2xl border border-border card-hover p-5">
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-border">
              <span className="text-sm font-semibold text-foreground/70">
                {getInitials(candidate.name)}
              </span>
            </div>
            <div className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white shadow-sm">
              {index + 1}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Link href={ROUTES.candidateDetail(candidate.id)} className="hover:underline">
                <h3 className="font-medium text-foreground text-sm">{candidate.name}</h3>
              </Link>
              <div className={`rounded-full ${scoreColor(scores.overall)} px-2 py-0.5 text-[10px] font-medium text-white`}>
                {scoreLabel(scores.overall)}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                High confidence
              </div>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
              {candidate.summary}
            </p>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-3">
              <span>{candidate.experience} yrs exp</span>
              <span className="text-border">|</span>
              <span className="capitalize">{candidate.education?.level ?? "N/A"}{candidate.education?.field ? ` in ${candidate.education.field}` : ""}</span>
              <span className="text-border">|</span>
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                Profile
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {candidate.skills.slice(0, 5).map((skill) => (
                <Badge key={skill} variant="secondary" className="text-[10px] bg-primary/5 text-primary">
                  <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                  {skill}
                </Badge>
              ))}
              {candidate.skills.length > 5 && (
                <Badge variant="outline" className="text-[10px]">
                  +{candidate.skills.length - 5}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center gap-1 shrink-0">
            <ScoreRing value={scores.overall} size={52} strokeWidth={2.5} label="Match" delay={index * 0.1} />
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-border">
          <div className="grid grid-cols-4 gap-3">
            <ProgressBar value={scores.skill * 100} label="Skills" size="sm" delay={0.3} />
            <ProgressBar value={scores.experience * 100} label="Experience" size="sm" color="bg-accent" delay={0.35} />
            <ProgressBar value={scores.education * 100} label="Education" size="sm" color="bg-chart-3" delay={0.4} />
            <ProgressBar value={scores.overall * 100} label="Overall" size="sm" color="bg-primary" delay={0.45} />
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-1 flex-1 mr-4">
            <span className="text-primary font-medium">AI:</span> {result.explanation}
          </p>
          <div className="flex items-center gap-1">
            <Link href={ROUTES.candidateDetail(candidate.id)}>
              <button className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                <Eye className="h-3.5 w-3.5" />
              </button>
            </Link>
            <button className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
              <GitCompare className="h-3.5 w-3.5" />
            </button>
            <button className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
              <Bookmark className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
})
