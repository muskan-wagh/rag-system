"use client"

import { memo } from "react"
import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { ProgressBar } from "@/components/ui/progress-bar"
import { Bookmark, GitCompare, Eye } from "lucide-react"
import Link from "next/link"
import { ROUTES, getInitials } from "@/lib/constants"
import type { RankingResult } from "@/lib/api"

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

export const CandidateCard = memo(function CandidateCard({ result, index }: { result: RankingResult; index: number }) {
  const { candidate, scores } = result

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
              <span className="text-sm font-medium text-muted" style={{ fontFamily: "var(--font-inter)" }}>
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
                <h3 className="font-medium text-ink text-[15px]" style={{ fontFamily: "var(--font-inter)" }}>{candidate.name}</h3>
              </Link>
              <div className={`rounded-md px-2 py-0.5 text-[10px] font-medium text-white ${scoreColor(scores.overall)}`} style={{ fontFamily: "var(--font-inter)" }}>
                {scoreLabel(scores.overall)}
              </div>
            </div>
            <p className="text-[13px] text-muted line-clamp-1 mb-2" style={{ fontFamily: "var(--font-inter)" }}>
              {candidate.summary}
            </p>
            <div className="flex items-center gap-3 text-xs text-faint mb-3" style={{ fontFamily: "var(--font-inter)" }}>
              <span className="font-data text-muted">{candidate.experience}y</span>
              <span className="text-border">|</span>
              <span className="capitalize">{candidate.education?.level ?? "N/A"}{candidate.education?.field ? ` in ${candidate.education.field}` : ""}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {candidate.skills.slice(0, 5).map((skill) => (
                <Badge key={skill} variant="secondary" className="text-[11px] font-normal" style={{ fontFamily: "var(--font-inter)" }}>
                  {skill}
                </Badge>
              ))}
              {candidate.skills.length > 5 && (
                <Badge variant="outline" className="text-[11px] font-normal" style={{ fontFamily: "var(--font-inter)" }}>
                  +{candidate.skills.length - 5}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center gap-1 shrink-0">
            <span className="font-data text-[28px] font-medium text-ink leading-none">
              {Math.round(scores.overall * 100)}%
            </span>
            <span className="text-[11px] text-faint uppercase" style={{ letterSpacing: "0.04em", fontFamily: "var(--font-inter)" }}>Match</span>
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
          <p className="text-xs text-faint leading-relaxed line-clamp-1 flex-1 mr-4" style={{ fontFamily: "var(--font-inter)" }}>
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
