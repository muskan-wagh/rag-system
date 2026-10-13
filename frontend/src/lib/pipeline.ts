/**
 * Canonical hiring pipeline on the client.
 *
 * Mirrors `backend/src/services/hiring/stageTypes.ts` — the backend owns the
 * truth and rejects invalid transitions server-side. This module exists so
 * every surface (dashboard, assessment workspace, candidate profile, tables)
 * renders the SAME ordered stages, the SAME short labels and the SAME
 * token-based colours in light and dark mode.
 */

export const PIPELINE_STAGES = [
  "Applied",
  "Screening",
  "Shortlisted",
  "Assessment",
  "Technical Round",
  "Interview",
  "Final Decision",
  "Hired",
] as const

export type PipelineStage = (typeof PIPELINE_STAGES)[number]

/** Terminal / parking outcomes. Not stages — they end or hold the pipeline. */
export const STAGE_OUTCOMES = ["Rejected", "Withdrawn", "Hold"] as const
export type StageOutcome = (typeof STAGE_OUTCOMES)[number]

/**
 * Legacy values that pre-date migration `20261009_canonical_stage_vocabulary.sql`.
 * Kept so a row that escaped the backfill still renders correctly.
 *
 * `Interview` is intentionally absent — it is now a canonical stage. Legacy rows
 * storing the generic `Interview` value are rewritten by the migration.
 */
const STAGE_ALIASES: Record<string, PipelineStage> = {
  "Technical Interview": "Technical Round",
  "Managerial/HR": "Interview",
  "HR Round": "Interview",
  "HR Interview": "Interview",
  Offer: "Final Decision",
  Offered: "Final Decision",
  "Interview Scheduled": "Interview",
  "Interview Completed": "Interview",
  Pending: "Applied",
}

/** Maps a stored stage value onto the canonical vocabulary, or null if unknown. */
export function normalizeStage(stage?: string | null): PipelineStage | StageOutcome | null {
  if (!stage) return null
  if ((PIPELINE_STAGES as readonly string[]).includes(stage)) return stage as PipelineStage
  if ((STAGE_OUTCOMES as readonly string[]).includes(stage)) return stage as StageOutcome
  return STAGE_ALIASES[stage] ?? null
}

export function stageRank(stage?: string | null): number {
  const canonical = normalizeStage(stage)
  if (!canonical) return -1
  const index = (PIPELINE_STAGES as readonly string[]).indexOf(canonical)
  if (index >= 0) return index
  return 99 // Rejected / Withdrawn / Hold
}

export function isTerminalStage(stage?: string | null): boolean {
  return normalizeStage(stage) === "Hired"
}

/** Compact labels for tight spaces (tab strips, steppers, chips). */
export const STAGE_SHORT_LABEL: Record<string, string> = {
  Applied: "Applied",
  Screening: "Screening",
  Shortlisted: "Shortlisted",
  Assessment: "Assessment",
  "Technical Round": "Technical",
  Interview: "Interview",
  "Final Decision": "Decision",
  Hired: "Hired",
}

/** Candidate-facing wording — never leaks internal stage names. */
export const STAGE_CANDIDATE_LABEL: Record<string, string> = {
  Applied: "Application received",
  Screening: "Resume screening",
  Shortlisted: "Shortlisted for assessment",
  Assessment: "Skills assessment",
  "Technical Round": "Technical interview",
  Interview: "HR interview",
  "Final Decision": "Final decision",
  Hired: "Hired",
}

/**
 * Tone drives colour through theme tokens only — never raw palette classes —
 * so stages stay legible in both light and dark mode.
 */
export type StageTone = "neutral" | "info" | "accent" | "warning" | "success" | "danger" | "muted"

export const STAGE_TONE: Record<string, StageTone> = {
  Applied: "warning",
  Screening: "info",
  // Distinct from Applied/Screening: shortlisting is a positive recruiter
  // decision, so it reads as an action hue rather than a warning.
  Shortlisted: "accent",
  Assessment: "accent",
  "Technical Round": "info",
  Interview: "warning",
  "Final Decision": "success",
  Hired: "success",
  Rejected: "danger",
  Withdrawn: "muted",
  Hold: "muted",
}

const TONE_CLASS: Record<StageTone, string> = {
  neutral: "border-border bg-surface-secondary text-ink",
  info: "border-info/25 bg-info/10 text-info",
  accent: "border-accent-border bg-accent-soft text-accent",
  warning: "border-warning/25 bg-warning/10 text-warning",
  success: "border-success/25 bg-success/10 text-success",
  danger: "border-danger/25 bg-danger/10 text-danger",
  muted: "border-border bg-surface-secondary text-muted",
}

/** Single source of truth for stage colour — used by badges, dots, rails, charts. */
export function stageToneClass(stage?: string | null): string {
  return TONE_CLASS[stageTone(stage)]
}

export function stageTone(stage?: string | null): StageTone {
  const canonical = normalizeStage(stage)
  return (canonical && STAGE_TONE[canonical]) || "neutral"
}

/** Solid dot colour for a stage, expressed as a theme token. */
export const STAGE_DOT: Record<StageTone, string> = {
  neutral: "bg-ink",
  info: "bg-info",
  accent: "bg-accent",
  warning: "bg-warning",
  success: "bg-success",
  danger: "bg-danger",
  muted: "bg-faint",
}

export function stageDotClass(stage?: string | null): string {
  return STAGE_DOT[stageTone(stage)]
}

/**
 * Filters offered on candidate/job lists, mapped to the query param the
 * backend understands. Keeping this here stops each screen inventing its own.
 */
export const STAGE_FILTERS: Array<{ value: string; label: string; stage?: string }> = [
  { value: "all", label: "All stages" },
  { value: "applied", label: "Applied", stage: "Applied" },
  { value: "screening", label: "Screening", stage: "Screening" },
  { value: "shortlisted", label: "Shortlisted", stage: "Shortlisted" },
  { value: "assessment", label: "Assessment", stage: "Assessment" },
  { value: "technical", label: "Technical round", stage: "Technical Round" },
  { value: "interview", label: "Interview", stage: "Interview" },
  { value: "final", label: "Final decision", stage: "Final Decision" },
  { value: "hired", label: "Hired", stage: "Hired" },
  { value: "rejected", label: "Rejected", stage: "Rejected" },
]

export function stageLabel(stage?: string | null): string {
  if (!stage) return "Unknown"
  const canonical = normalizeStage(stage)
  if (canonical) return STAGE_SHORT_LABEL[canonical] ?? canonical
  return stage
}