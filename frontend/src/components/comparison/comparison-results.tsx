"use client"

import { motion } from "framer-motion"
import { FileText, Award, CheckCircle2, AlertTriangle, MessageSquareText, XCircle, Layers, User, ArrowRight } from "lucide-react"
import type { CompareResult } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface ComparisonResultsProps {
  result: CompareResult
  onScheduleInterview?: (candidateId: string, name: string) => void
  onAddToPool?: (candidateId: string, name: string) => void
  onEmail?: (candidateId: string, name: string) => void
  onShortlist?: (candidateId: string, name: string) => void
  onReject?: (candidateId: string, name: string) => void
}

function CandidateHeader({ name, title, company, experience, skills }: { name: string; title?: string; company?: string; experience: number; skills: string[] }) {
  const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-ink">{name}</h3>
        {(title || company) && (
          <p className="text-xs text-muted truncate mt-0.5">
            {title}{title && company ? " · " : ""}{company}
          </p>
        )}
        <p className="text-[11px] text-faint mt-0.5">
          {experience}y exp · {skills.length} skills
        </p>
      </div>
    </div>
  )
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-muted w-24 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <span className="font-data text-[11px] text-ink w-8 text-right">{Math.round(value)}%</span>
    </div>
  )
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const } },
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
  const numCandidates = candidates.length

  function scoreColor(value: number): string {
    if (value >= 85) return "#059669"
    if (value >= 70) return "#2563EB"
    if (value >= 50) return "#D97706"
    return "#DC2626"
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Recommendation Banner */}
      {winner && (
        <motion.div variants={itemVariants}>
          <div className="relative overflow-hidden rounded-xl border border-success/20 bg-gradient-to-br from-success/[0.04] via-white to-success/[0.02] p-5">
            <div className="absolute top-0 right-0 w-36 h-36 bg-success/[0.03] rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/10">
                <Award className="h-5 w-5 text-success" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-success">Best Fit</span>
                  <span className="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                    {winner.scores.overall}% match
                  </span>
                </div>
                <p className="text-sm font-semibold text-ink">{winner.name}</p>
                <p className="text-xs text-muted leading-relaxed mt-1">{recommendation.reasoning}</p>
              </div>
              <ArrowRight className="hidden sm:block h-5 w-5 text-success/40 mt-1 shrink-0" strokeWidth={1.5} />
            </div>
          </div>
        </motion.div>
      )}

      {/* Score Cards Grid */}
      <motion.div variants={itemVariants}>
        <h2 className="text-sm font-semibold text-ink mb-3">Candidate Scores</h2>
        <div className={cn(
          "grid gap-4",
          numCandidates === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1",
        )}>
          {candidates.map((candidate, i) => (
            <motion.div
              key={candidate.candidateId}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.06 }}
              className={cn(
                "bg-surface border border-border rounded-xl p-5",
                candidate.candidateId === recommendation.candidateId && "ring-1 ring-success/20"
              )}
            >
              <CandidateHeader
                name={candidate.name}
                title={candidate.title}
                company={candidate.company}
                experience={candidate.experience}
                skills={candidate.skills}
              />

              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center h-12 w-12 rounded-full border-2" style={{ borderColor: scoreColor(candidate.scores.overall) }}>
                  <span className="font-data text-lg font-semibold" style={{ color: scoreColor(candidate.scores.overall) }}>
                    {candidate.scores.overall}%
                  </span>
                </div>
                <div className="flex-1 space-y-1">
                  {([["technical", "Technical"], ["experience", "Experience"], ["education", "Education"]] as const).map(([key, label]) => (
                    <ScoreBar key={key} label={label} value={candidate.scores[key]} color={scoreColor(candidate.scores[key])} />
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button size="xs" variant="default" onClick={() => onScheduleInterview(candidate.candidateId, candidate.name)}>
                  Interview
                </Button>
                <Button size="xs" variant="outline" onClick={() => onShortlist(candidate.candidateId, candidate.name)}>
                  Shortlist
                </Button>
                <Button size="xs" variant="ghost" onClick={() => onEmail(candidate.candidateId, candidate.name)}>
                  Email
                </Button>
                <Button size="xs" variant="ghost" onClick={() => onAddToPool(candidate.candidateId, candidate.name)}>
                  Pool
                </Button>
                <Button size="xs" variant="destructive" onClick={() => onReject(candidate.candidateId, candidate.name)}>
                  Reject
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Executive Summary */}
      {summary && (
        <motion.div variants={itemVariants} className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-muted" strokeWidth={1.5} />
            <h3 className="text-sm font-semibold text-ink">Executive Summary</h3>
          </div>
          <p className="text-xs text-muted leading-relaxed">{summary}</p>
        </motion.div>
      )}

      {/* Strengths & Weaknesses */}
      <motion.div variants={itemVariants} className="bg-surface border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-ink mb-4">Strengths &amp; Weaknesses</h3>
        <div className={cn("grid gap-6", numCandidates === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
          {candidates.map((candidate) => (
            <div key={candidate.candidateId} className="space-y-3">
              <p className="text-xs font-semibold text-ink">{candidate.name}</p>
              {candidate.strengths.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <CheckCircle2 className="h-3 w-3 text-success" strokeWidth={1.5} />
                    <span className="text-[11px] font-medium text-success">Strengths</span>
                  </div>
                  <ul className="space-y-0.5">
                    {candidate.strengths.slice(0, 5).map((s, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-ink">
                        <span className="h-1 w-1 rounded-full bg-success/50 mt-1.5 shrink-0" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {candidate.weaknesses.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <XCircle className="h-3 w-3 text-danger" strokeWidth={1.5} />
                    <span className="text-[11px] font-medium text-danger">Weaknesses</span>
                  </div>
                  <ul className="space-y-0.5">
                    {candidate.weaknesses.slice(0, 5).map((w, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-ink">
                        <span className="h-1 w-1 rounded-full bg-danger/50 mt-1.5 shrink-0" />
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {candidate.verdict && (
                <p className="text-xs text-muted italic">{candidate.verdict}</p>
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Skill Coverage */}
      {skillOverlap && (skillOverlap.shared.length > 0 || Object.keys(skillOverlap.unique).length > 0) && (
        <motion.div variants={itemVariants} className="bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-ink mb-4">Skill Coverage</h3>
          {skillOverlap.shared.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Layers className="h-3.5 w-3.5 text-blue-500" strokeWidth={1.5} />
                <span className="text-[11px] font-medium text-blue-600 uppercase tracking-wider">Shared Skills</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {skillOverlap.shared.map((skill) => (
                  <Badge key={skill} variant="secondary" className="text-[11px]">{skill}</Badge>
                ))}
              </div>
            </div>
          )}
          <div className={cn("grid gap-4", numCandidates === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
            {candidates.map((candidate) => {
              const uniqueSkills = skillOverlap.unique[candidate.candidateId]
              if (!uniqueSkills || uniqueSkills.length === 0) return null
              return (
                <div key={candidate.candidateId}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <User className="h-3.5 w-3.5 text-amber-500" strokeWidth={1.5} />
                    <span className="text-[11px] font-medium text-amber-600 uppercase tracking-wider">
                      {candidate.name.split(" ")[0]}&apos;s unique skills
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {uniqueSkills.map((skill) => (
                      <Badge key={skill} variant="warning" className="text-[11px]">{skill}</Badge>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Hiring Risks */}
      {candidates.some(c => c.missingSkills.length > 0 || c.risks.length > 0) && (
        <motion.div variants={itemVariants} className="bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-ink mb-4">Hiring Risks</h3>
          <div className={cn("grid gap-6", numCandidates === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
            {candidates.map((candidate) => (
              <div key={candidate.candidateId} className="space-y-3">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">{candidate.name}</p>
                {candidate.missingSkills.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <XCircle className="h-3 w-3 text-danger" strokeWidth={1.5} />
                      <span className="text-[11px] font-medium text-danger">Missing Skills</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {candidate.missingSkills.map((skill) => (
                        <Badge key={skill} variant="destructive" className="text-[11px]">{skill}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {candidate.risks.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <AlertTriangle className="h-3 w-3 text-amber-500" strokeWidth={1.5} />
                      <span className="text-[11px] font-medium text-amber-600">Risks</span>
                    </div>
                    <ul className="space-y-0.5">
                      {candidate.risks.slice(0, 4).map((risk, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-ink">
                          <span className="h-1 w-1 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                          {risk}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Interview Questions */}
      {interviewQuestions.length > 0 && (
        <motion.div variants={itemVariants} className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquareText className="h-4 w-4 text-purple-500" strokeWidth={1.5} />
            <h3 className="text-sm font-semibold text-ink">Interview Questions</h3>
          </div>
          <div className="space-y-2">
            {interviewQuestions.slice(0, 6).map((question, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-surface-secondary">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-100 text-[10px] font-medium text-purple-600">{i + 1}</span>
                <p className="text-xs text-ink leading-relaxed">{question}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
