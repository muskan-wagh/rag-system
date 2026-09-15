"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import {
  Sparkles,
  CircleCheck,
  TriangleAlert,
  Calendar,
  UserCheck,
  CircleX,
  Mail,
  Plus,
  Tags,
  ArrowRight,
  Briefcase,
  GraduationCap,
} from "lucide-react"
import type { CompareResult, ComparisonCandidate } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScoreRing } from "@/components/ui/score-ring"
import { ROUTES, getInitials } from "@/lib/constants"
import { cn } from "@/lib/utils"

interface ComparisonResultsProps {
  result: CompareResult
  onScheduleInterview?: (candidateId: string, name: string) => void
  onAddToPool?: (candidateId: string, name: string) => void
  onEmail?: (candidateId: string, name: string) => void
  onShortlist?: (candidateId: string, name: string) => void
  onReject?: (candidateId: string, name: string) => void
}

/** Scores here are 0–100. Green = strong, amber = medium, red = weak. */
function scoreColor(value: number): string {
  if (value >= 75) return "#16A34A"
  if (value >= 55) return "#D97706"
  return "#DC2626"
}

function barClass(value: number): string {
  if (value >= 75) return "bg-success"
  if (value >= 55) return "bg-warning"
  return "bg-danger"
}

/** Per-candidate accent hues — kills the gray sameness, cycles for 3+ candidates. */
const CANDIDATE_ACCENTS = [
  {
    avatar: "bg-sky-500/10 text-sky-600 ring-sky-500/30 dark:text-sky-300",
    tag: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    label: "text-sky-600 dark:text-sky-300",
  },
  {
    avatar: "bg-violet-500/10 text-violet-600 ring-violet-500/30 dark:text-violet-300",
    tag: "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    label: "text-violet-600 dark:text-violet-300",
  },
  {
    avatar: "bg-fuchsia-500/10 text-fuchsia-600 ring-fuchsia-500/30 dark:text-fuchsia-300",
    tag: "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
    label: "text-fuchsia-600 dark:text-fuchsia-300",
  },
  {
    avatar: "bg-amber-500/10 text-amber-600 ring-amber-500/30 dark:text-amber-300",
    tag: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    label: "text-amber-600 dark:text-amber-300",
  },
]

function accentFor(index: number) {
  return CANDIDATE_ACCENTS[index % CANDIDATE_ACCENTS.length]
}

function Section({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: typeof Mail
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-surface-secondary text-muted">
          <Icon className="size-3.5" strokeWidth={1.75} />
        </span>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted">{title}</h3>
        {action && <span className="ml-auto">{action}</span>}
      </div>
      {children}
    </section>
  )
}

function CandidateMiniHeader({
  candidate,
  accent,
}: {
  candidate: ComparisonCandidate
  accent: (typeof CANDIDATE_ACCENTS)[number]
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ring-1",
          accent.avatar,
        )}
      >
        {getInitials(candidate.name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-semibold text-ink">{candidate.name}</p>
        {(candidate.title || candidate.company) && (
          <p className="truncate text-[11.5px] text-muted">
            {candidate.title}
            {candidate.title && candidate.company ? " · " : ""}
            {candidate.company}
          </p>
        )}
      </div>
    </div>
  )
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } },
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
  const winner = candidates.find((c) => c.candidateId === recommendation.candidateId)
  const twoCol = candidates.length === 2

  const metricRows: { key: "technical" | "experience" | "education" | "overall"; label: string }[] = [
    { key: "technical", label: "Technical" },
    { key: "experience", label: "Experience" },
    { key: "education", label: "Education" },
    { key: "overall", label: "Overall" },
  ]

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-3"
    >
      {/* AI Best Fit */}
      {winner && (
        <motion.div variants={itemVariants}>
          <div className="rounded-xl border border-emerald-500/30 bg-[radial-gradient(90%_130%_at_8%_0%,rgba(16,185,129,0.14),transparent_55%),radial-gradient(70%_120%_at_95%_15%,rgba(129,140,248,0.12),transparent_60%)] p-3.5 shadow-[0_0_36px_rgba(16,185,129,0.10)]">
            <div className="flex items-start gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-success/15">
                <Sparkles className="size-3.5 text-success" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-success">
                    ✦ Best fit
                  </span>
                  <span className="rounded-full bg-success/15 px-2 py-0.5 font-data text-[11px] font-semibold text-success">
                    {winner.scores.overall}% match
                  </span>
                </div>
                <p className="mt-1 text-[13.5px] font-semibold text-ink">{winner.name}</p>
                <p className="mt-0.5 line-clamp-3 text-[12.5px] leading-relaxed text-muted">
                  {recommendation.reasoning}
                </p>
                <Link
                  href={ROUTES.candidateDetail(winner.candidateId)}
                  className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary-solid px-3.5 text-[12px] font-medium text-primary-solid-text transition-all hover:bg-primary-solid-hover"
                >
                  View Candidate
                  <ArrowRight className="size-3.5" strokeWidth={1.75} />
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Candidate score cards */}
      <motion.div variants={itemVariants}>
        <div className={cn("grid grid-cols-1 gap-3", twoCol && "md:grid-cols-2")}>
          {candidates.map((candidate, i) => {
            const isWinner = candidate.candidateId === recommendation.candidateId
            const accent = accentFor(i)
            return (
              <motion.div
                key={candidate.candidateId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.06 }}
                className={cn(
                  "rounded-xl border border-border bg-surface p-4",
                  isWinner && "border-emerald-500/40 shadow-[0_0_28px_rgba(16,185,129,0.10)]",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <CandidateMiniHeader candidate={candidate} accent={accent} />
                  <ScoreRing
                    value={Math.min(100, Math.max(0, candidate.scores.overall)) / 100}
                    size={52}
                    color={scoreColor(candidate.scores.overall)}
                  />
                </div>

                <div className="mt-3 space-y-2">
                  {(
                    [
                      ["technical", "Technical"],
                      ["experience", "Experience"],
                      ["education", "Education"],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key}>
                      <div className="mb-1 flex items-center justify-between text-[11.5px]">
                        <span className="text-muted">{label}</span>
                        <span className="font-data font-medium text-ink">
                          {Math.round(candidate.scores[key])}%
                        </span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-track">
                        <div
                          className={cn("h-full rounded-full", barClass(candidate.scores[key]))}
                          style={{ width: `${Math.min(100, Math.max(0, candidate.scores[key]))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
                  <Button size="xs" onClick={() => onScheduleInterview(candidate.candidateId, candidate.name)}>
                    <Calendar className="size-3" strokeWidth={1.75} />
                    Interview
                  </Button>
                  <Button size="xs" variant="outline" onClick={() => onShortlist(candidate.candidateId, candidate.name)}>
                    <UserCheck className="size-3" strokeWidth={1.75} />
                    Shortlist
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => onEmail(candidate.candidateId, candidate.name)}>
                    <Mail className="size-3" strokeWidth={1.75} />
                    Email
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => onAddToPool(candidate.candidateId, candidate.name)}>
                    <Plus className="size-3" strokeWidth={1.75} />
                    Pool
                  </Button>
                  <Button size="xs" variant="destructive" onClick={() => onReject(candidate.candidateId, candidate.name)}>
                    <CircleX className="size-3" strokeWidth={1.75} />
                    Reject
                  </Button>
                </div>
              </motion.div>
            )
          })}
        </div>
      </motion.div>

      {/* Side-by-side metrics matrix */}
      <motion.div variants={itemVariants}>
        <Section icon={Briefcase} title="Metric comparison">
          <div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:thin]">
            <div className="min-w-[300px]">
              <div
                className="grid items-center gap-2 pb-1.5 text-[11px] font-medium text-faint"
                style={{
                  gridTemplateColumns: `72px repeat(${candidates.length}, minmax(0, 1fr))`,
                }}
              >
                <span />
                {candidates.map((c, i) => (
                  <span key={c.candidateId} className={cn("truncate font-semibold", accentFor(i).label)}>
                    {c.name.split(" ")[0]}
                  </span>
                ))}
              </div>
              <div className="space-y-2.5">
                {metricRows.map((row) => (
                  <div
                    key={row.key}
                    className="grid items-center gap-2"
                    style={{
                      gridTemplateColumns: `72px repeat(${candidates.length}, minmax(0, 1fr))`,
                    }}
                  >
                    <span className="text-[12px] text-muted">{row.label}</span>
                    {candidates.map((c) => (
                      <div key={c.candidateId} className="flex items-center gap-1.5">
                        <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-track">
                          <div
                            className={cn("h-full rounded-full", barClass(c.scores[row.key]))}
                            style={{ width: `${Math.min(100, Math.max(0, c.scores[row.key]))}%` }}
                          />
                        </div>
                        <span className="w-9 shrink-0 text-right font-data text-[11.5px] font-medium text-ink">
                          {Math.round(c.scores[row.key])}%
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>
      </motion.div>

      {/* Executive summary */}
      {summary && (
        <motion.div variants={itemVariants}>
          <Section icon={Sparkles} title="Executive summary">
            <p className="max-w-none text-[13px] leading-relaxed text-muted">{summary}</p>
          </Section>
        </motion.div>
      )}

      {/* Strengths & weaknesses */}
      <motion.div variants={itemVariants}>
        <Section icon={CircleCheck} title="Strengths & weaknesses">
          <div className={cn("grid grid-cols-1 gap-4", twoCol && "md:grid-cols-2")}>
            {candidates.map((candidate) => (
              <div key={candidate.candidateId} className="min-w-0">
                <p className="mb-2 truncate text-[13px] font-semibold text-ink">{candidate.name}</p>
                {candidate.strengths.length > 0 && (
                  <div className="mb-2.5">
                    <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-success">
                      <CircleCheck className="size-3" strokeWidth={1.75} />
                      Strengths
                    </p>
                    <ul className="space-y-1">
                      {candidate.strengths.slice(0, 5).map((s, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[12.5px] leading-relaxed text-muted">
                          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-success" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {candidate.weaknesses.length > 0 && (
                  <div>
                    <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-danger">
                      <TriangleAlert className="size-3" strokeWidth={1.75} />
                      Weaknesses
                    </p>
                    <ul className="space-y-1">
                      {candidate.weaknesses.slice(0, 5).map((w, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[12.5px] leading-relaxed text-muted">
                          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-danger" />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {candidate.verdict && (
                  <p className="mt-2 border-l-2 border-border pl-2 text-[12px] italic leading-relaxed text-faint">
                    {candidate.verdict}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>
      </motion.div>

      {/* Skill coverage */}
      {skillOverlap && (skillOverlap.shared.length > 0 || Object.keys(skillOverlap.unique).length > 0) && (
        <motion.div variants={itemVariants}>
          <Section icon={Tags} title="Skill coverage">
            {skillOverlap.shared.length > 0 && (
              <div className="mb-3">
                <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-indigo-500 dark:text-indigo-300">
                  Shared skills
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {skillOverlap.shared.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-md border border-indigo-500/25 bg-indigo-500/10 px-2 py-1 text-[11px] text-indigo-700 dark:text-indigo-200"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className={cn("grid grid-cols-1 gap-3", twoCol && "md:grid-cols-2")}>
              {candidates.map((candidate, i) => {
                const uniqueSkills = skillOverlap.unique[candidate.candidateId]
                if (!uniqueSkills || uniqueSkills.length === 0) return null
                const accent = accentFor(i)
                return (
                  <div key={candidate.candidateId} className="min-w-0">
                    <p className={cn("mb-1.5 truncate text-[10.5px] font-semibold uppercase tracking-[0.06em]", accent.label)}>
                      {candidate.name.split(" ")[0]}&apos;s unique skills
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {uniqueSkills.map((skill) => (
                        <span
                          key={skill}
                          className={cn("rounded-md border px-2 py-1 text-[11px]", accent.tag)}
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            {candidates.some((c) => c.missingSkills.length > 0) && (
              <div className="mt-3 border-t border-border pt-3">
                <div className={cn("grid grid-cols-1 gap-3", twoCol && "md:grid-cols-2")}>
                  {candidates.map((candidate) =>
                    candidate.missingSkills.length > 0 ? (
                      <div key={candidate.candidateId} className="min-w-0">
                        <p className="mb-1.5 truncate text-[10.5px] font-semibold uppercase tracking-[0.06em] text-danger">
                          {candidate.name.split(" ")[0]} is missing
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {candidate.missingSkills.map((skill) => (
                            <Badge key={skill} variant="destructive" className="text-[11px]">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : null,
                  )}
                </div>
              </div>
            )}
          </Section>
        </motion.div>
      )}

      {/* Hiring risks */}
      {candidates.some((c) => c.risks.length > 0) && (
        <motion.div variants={itemVariants}>
          <Section icon={TriangleAlert} title="Hiring risks">
            <div className={cn("grid grid-cols-1 gap-3", twoCol && "md:grid-cols-2")}>
              {candidates.map((candidate) =>
                candidate.risks.length > 0 ? (
                  <div key={candidate.candidateId} className="min-w-0">
                    <p className="mb-1 truncate text-[12.5px] font-semibold text-ink">{candidate.name}</p>
                    <ul className="space-y-1">
                      {candidate.risks.slice(0, 4).map((risk, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[12.5px] leading-relaxed text-muted">
                          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-warning" />
                          {risk}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null,
              )}
            </div>
          </Section>
        </motion.div>
      )}

      {/* Interview questions */}
      {interviewQuestions.length > 0 && (
        <motion.div variants={itemVariants}>
          <Section icon={Briefcase} title={`Interview questions · ${Math.min(interviewQuestions.length, 6)}`}>
            <ol className="space-y-1.5">
              {interviewQuestions.slice(0, 6).map((question, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 rounded-lg bg-surface-secondary/60 p-2.5"
                >
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-500/15 font-data text-[10px] font-semibold text-violet-600 dark:text-violet-300">
                    {i + 1}
                  </span>
                  <p className="text-[12.5px] leading-relaxed text-muted">{question}</p>
                </li>
              ))}
            </ol>
          </Section>
        </motion.div>
      )}

      {/* Hiring decision */}
      {winner && (
        <motion.div variants={itemVariants}>
          <Section icon={UserCheck} title="Hiring decision">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success/15 text-[12px] font-semibold text-success">
                  {getInitials(winner.name)}
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] text-faint">Best fit</p>
                  <p className="truncate text-[13.5px] font-semibold text-ink">{winner.name}</p>
                </div>
                <span className="ml-auto shrink-0 font-data text-[15px] font-semibold text-success sm:ml-2">
                  {winner.scores.overall}%
                </span>
              </div>
            </div>
            <p className="mt-2 line-clamp-2 text-[12.5px] leading-relaxed text-muted">
              {recommendation.reasoning}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
              <Link
                href={ROUTES.candidateDetail(winner.candidateId)}
                className="inline-flex h-7 items-center gap-1 rounded-md bg-primary-solid px-2.5 text-xs font-medium text-primary-solid-text transition-all hover:bg-primary-solid-hover"
              >
                View Profile
              </Link>
              <Button size="xs" onClick={() => onScheduleInterview(winner.candidateId, winner.name)}>
                <Calendar className="size-3" strokeWidth={1.75} />
                Schedule Interview
              </Button>
              <Button size="xs" variant="outline" onClick={() => onShortlist(winner.candidateId, winner.name)}>
                <UserCheck className="size-3" strokeWidth={1.75} />
                Shortlist
              </Button>
              <Button size="xs" variant="destructive" onClick={() => onReject(winner.candidateId, winner.name)}>
                <CircleX className="size-3" strokeWidth={1.75} />
                Reject
              </Button>
            </div>
          </Section>
        </motion.div>
      )}

      {/* Education footnote */}
      <motion.p
        variants={itemVariants}
        className="flex items-center gap-1.5 px-1 text-[11.5px] text-faint"
      >
        <GraduationCap className="size-3.5 shrink-0" strokeWidth={1.75} />
        Education scores reflect formal qualification alignment for the role.
      </motion.p>
    </motion.div>
  )
}
