/**
 * Canonical hiring pipeline (correction #3).
 *
 * Pipeline stages (ordered):
 *   Applied -> Screening -> Assessment ->
 *   Technical Interview -> Managerial/HR -> Offer -> Hired
 *
 * Outcomes (NOT pipeline stages):
 *   Rejected | Withdrawn | Hold
 *
 * Legacy 'Interview' stage_type is preserved in the DB CHECK for
 * backward compat with existing rows, but new code MUST write the
 * specific 'Technical Interview' / 'Managerial/HR' values.
 */

export const PIPELINE_STAGES = [
  'Applied',
  'Screening',
  'Assessment',
  'Technical Interview',
  'Managerial/HR',
  'Offer',
  'Hired',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const STAGE_OUTCOMES = ['Rejected', 'Withdrawn', 'Hold'] as const;
export type StageOutcome = (typeof STAGE_OUTCOMES)[number];

/** Legacy generic value kept only for reading old rows. Never write it. */
export const LEGACY_INTERVIEW_STAGE = 'Interview';

export const STAGE_ORDER: Record<string, number> = {
  Applied: 0,
  Screening: 1,
  Assessment: 2,
  'Technical Interview': 3,
  'Managerial/HR': 4,
  Offer: 5,
  Hired: 6,
  // Legacy + outcomes sort defensively at the end.
  Interview: 3,
  Rejected: 99,
  Withdrawn: 99,
  Hold: 99,
};

export function isPipelineStage(value: unknown): value is PipelineStage {
  return typeof value === 'string' && (PIPELINE_STAGES as readonly string[]).includes(value);
}

export function isStageOutcome(value: unknown): value is StageOutcome {
  return typeof value === 'string' && (STAGE_OUTCOMES as readonly string[]).includes(value);
}

/** Next pipeline stage after a successful evaluation, or null if terminal. */
export function nextStageAfter(from: string): PipelineStage | null {
  switch (from) {
    case 'Assessment':
      return 'Technical Interview';
    case 'Technical Interview':
    case 'Interview': // legacy rows advance to HR
      return 'Managerial/HR';
    case 'Managerial/HR':
      return 'Offer';
    case 'Offer':
      return 'Hired';
    default:
      return null;
  }
}
