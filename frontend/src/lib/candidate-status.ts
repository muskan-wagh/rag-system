import { stageToneClass, stageLabel, stageDotClass } from "./pipeline"

export const CANDIDATE_STATUS = {
  APPLIED: "Applied",
  SHORTLISTED: "Shortlisted",
  SCREENING: "Screening",
  INTERVIEW_SCHEDULED: "Interview Scheduled",
  INTERVIEW_COMPLETED: "Interview Completed",
  TECHNICAL_ROUND: "Technical Round",
  HR_ROUND: "HR Round",
  OFFERED: "Offered",
  HIRED: "Hired",
  REJECTED: "Rejected",
} as const

/**
 * Stage/status colour now resolves through the theme tokens in `pipeline.ts`
 * instead of hardcoded `bg-amber-50` style palette classes, which were
 * unreadable in dark mode and off-brand.
 */
export function getStatusColor(status?: string | null): string {
  return stageToneClass(status)
}

export { stageLabel, stageDotClass }
