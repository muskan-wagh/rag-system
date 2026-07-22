"use client"

import { motion } from "framer-motion"
import { Award, ArrowRight } from "lucide-react"
import type { ComparisonCandidate, ComparisonRecommendation } from "@/lib/api"

interface RecommendationBannerProps {
  recommendation: ComparisonRecommendation
  candidate: ComparisonCandidate | undefined
}

export function RecommendationBanner({ recommendation, candidate }: RecommendationBannerProps) {
  if (!candidate) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      className="relative overflow-hidden rounded-2xl border border-success/20 bg-gradient-to-br from-success/[0.04] via-white to-success/[0.02] p-6"
    >
      <div className="absolute top-0 right-0 w-48 h-48 bg-success/[0.03] rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="relative flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-success/10">
          <Award className="h-6 w-6 text-success" strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-success">Best Fit</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
              {candidate.scores.overall}% match
            </span>
          </div>
          <p className="text-base font-medium text-ink mb-1">
            {candidate.name}
            {candidate.title && <span className="text-muted font-normal"> &middot; {candidate.title}</span>}
          </p>
          <p className="text-sm text-muted leading-relaxed">{recommendation.reasoning}</p>
        </div>
        <ArrowRight className="hidden sm:block h-5 w-5 text-success/40 mt-1 shrink-0" strokeWidth={1.5} />
      </div>
    </motion.div>
  )
}
