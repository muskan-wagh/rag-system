"use client"

import { motion } from "framer-motion"
import { FileText } from "lucide-react"
import type { CompareResult } from "@/lib/api"
import { RecommendationBanner } from "./recommendation-banner"
import { CandidateScoreCard } from "./candidate-score-card"
import { StrengthsWeaknesses } from "./strengths-weaknesses"
import { SkillOverlap } from "./skill-overlap"
import { CandidateRisks } from "./candidate-risks"
import { InterviewQuestions } from "./interview-questions"
import { ComparisonActions } from "./comparison-actions"

interface ComparisonResultsProps {
  result: CompareResult
  onScheduleInterview?: (candidateId: string, name: string) => void
  onAddToPool?: (candidateId: string, name: string) => void
  onEmail?: (candidateId: string, name: string) => void
  onShortlist?: (candidateId: string, name: string) => void
  onReject?: (candidateId: string, name: string) => void
}

export function ComparisonResults({
  result,
  onScheduleInterview = () => {},
  onAddToPool = () => {},
  onEmail = () => {},
  onShortlist = () => {},
  onReject = () => {},
}: ComparisonResultsProps) {
  const { candidates, recommendation, summary, interviewQuestions, skillOverlap } = result
  const winner = candidates.find(c => c.candidateId === recommendation.candidateId)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-5"
    >
      <RecommendationBanner recommendation={recommendation} candidate={winner} />

      <div className="flex gap-5 overflow-x-auto pb-2">
        {candidates.map((candidate, i) => (
          <CandidateScoreCard
            key={candidate.candidateId}
            candidate={candidate}
            index={i}
            total={candidates.length}
          />
        ))}
      </div>

      {summary && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="bg-white rounded-2xl border border-border p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-muted" strokeWidth={1.5} />
            <h3 className="text-sm font-medium text-ink">Executive Summary</h3>
          </div>
          <p className="text-xs text-muted leading-relaxed">{summary}</p>
        </motion.div>
      )}

      <StrengthsWeaknesses candidates={candidates} />
      <SkillOverlap skillOverlap={skillOverlap} candidates={candidates} />
      <CandidateRisks candidates={candidates} />
      <InterviewQuestions questions={interviewQuestions} />

      <ComparisonActions
        candidates={candidates}
        onScheduleInterview={onScheduleInterview}
        onAddToPool={onAddToPool}
        onEmail={onEmail}
        onShortlist={onShortlist}
        onReject={onReject}
      />
    </motion.div>
  )
}
