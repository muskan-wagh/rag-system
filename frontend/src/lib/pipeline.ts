/**
 * Canonical hiring pipeline on the client.
 *
 * Mirrors `backend/src/services/hiring/stageTypes.ts` — the backend owns the
 * truth and rejects invalid transitions server-side. This module exists so
 * every surface (dashboard, job workspace, candidate profile, tables) renders
 * the SAME ordered stages, the SAME short labels and the SAME token-based
 * colours in light and dark mode.
 */

export const PIPELINE_STAGES = [
  "Applied",
  "Screening",
  "Assessment",
  "Technical Interview",
  "Managerial/HR",
  "Offer",
  "Hired",
] as const

export type PipelineStage = (typeof PIPELINE_STAGES)[number]

/** Terminal / parking outcomes. Not stages — they end or hold the pipeline. */
export const STAGE_OUTCOMES = ["Rejected", "Withdrawn", "Hold"] as const
export type StageOutcome = (typeof STAGE_OUTCOMES)[number]

const STAGE_RANK: Record<string, number> = {
  Applied: 0,
  // Legacy synonym of Applied.
  Shortlisted: 0,
  Screening: 1,
  Assessment: 2,
  "Technical Interview": 3,
  // Legacy rows still carry the generic "Interview" value.
  Interview: 3,
  "Managerial/HR": 4,
  Offer: 5,
  Hired: 6,
  Rejected: 99,
  Withdrawn: 99,
  Hold: 99,
}

export function stageRank(stage?: string | null): number {
  if (!stage) return -1
  const rank = STAGE_RANK[stage]
  return typeof rank === "number" ? rank : -1
}

export function isTerminalStage(stage?: string | null): boolean {
  return stage === "Hired"
}

/** Compact labels for tight spaces (tab strips, steppers, chips). */
export const STAGE_SHORT_LABEL: Record<string, string> = {
  Applied: "Applied",
  Screening: "Screening",
  Assessment: "Assessment",
  "Technical Interview": "Technical",
  "Managerial/HR": "HR",
  Offer: "Offer",
  Hired: "Hired",
}

/** Candidate-facing wording — never leaks internal stage names. */
export const STAGE_CANDIDATE_LABEL: Record<string, string> = {
  Applied: "Application received",
  Screening: "Resume screening",
  Assessment: "Skills assessment",
  "Technical Interview": "Technical interview",
  "Managerial/HR": "HR interview",
  Offer: "Offer",
  Hired: "Hired",
}

/**
 * Tone drives colour through theme tokens only — never raw palette classes —
 * so stages stay legible in both light and dark mode.
 */
export type StageTone = "neutral" | "info" | "accent" | "warning" | "success" | "danger" | "muted"

export const STAGE_TONE: Record<string, StageTone> = {
  Applied: "warning",
  Shortlisted: "warning",
  Screening: "info",
  Assessment: "accent",
  "Technical Interview": "info",
  "Technical Round": "info",
  "Interview Scheduled": "info",
  "Interview Completed": "info",
  Interview: "info",
  "Managerial/HR": "warning",
  "HR Round": "warning",
  Offer: "success",
  Offered: "success",
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
  const tone: StageTone = (stage && STAGE_TONE[stage]) || "neutral"
  return TONE_CLASS[tone]
}

export function stageTone(stage?: string | null): StageTone {
  return (stage && STAGE_TONE[stage]) || "neutral"
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
  { value: "assessment", label: "Assessment", stage: "Assessment" },
  { value: "technical", label: "Technical interview", stage: "Technical Interview" },
  { value: "hr", label: "Managerial / HR", stage: "Managerial/HR" },
  { value: "offer", label: "Offer", stage: "Offer" },
  { value: "hired", label: "Hired", stage: "Hired" },
  { value: "rejected", label: "Rejected", stage: "Rejected" },
]

/** Legacy status strings still present on older candidate rows. */
const LEGACY_LABELS: Record<string, string> = {
  shortlisted: "Applied",
  "interview scheduled": "Interview Scheduled",
  "interview completed": "Interview Completed",
  "technical round": "Technical Interview",
  "hr round": "Managerial/HR",
  offered: "Offer",
}

export function stageLabel(stage?: string | null): string {
  if (!stage) return "Unknown"
  const legacy = LEGACY_LABELS[stage.toLowerCase()]
  if (legacy) return legacy
  return STAGE_SHORT_LABEL[stage] ?? stage
}
