export const CANDIDATE_STATUS = {
  APPLIED: 'Applied',
  SHORTLISTED: 'Shortlisted',
  SCREENING: 'Screening',
  INTERVIEW: 'Interview',
  INTERVIEW_SCHEDULED: 'Interview Scheduled',
  INTERVIEW_COMPLETED: 'Interview Completed',
  TECHNICAL_ROUND: 'Technical Round',
  HR_ROUND: 'HR Round',
  OFFERED: 'Offered',
  HIRED: 'Hired',
  REJECTED: 'Rejected',
} as const;

export type CandidateStatus = (typeof CANDIDATE_STATUS)[keyof typeof CANDIDATE_STATUS];

export const CANDIDATE_STATUS_VALUES: readonly string[] = Object.values(CANDIDATE_STATUS);

export const PROCESSING_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;

export const INTERVIEW_STATUS = {
  SCHEDULED: 'scheduled',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export const OFFER_STATUS = {
  OFFERED: 'offered',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
} as const;

export const REJECTION_REASON = {
  NOT_QUALIFIED: 'not_qualified',
  LOW_SCORE: 'low_score',
  EXPERIENCE_MISMATCH: 'experience_mismatch',
  POSITION_FILLED: 'position_filled',
  OTHER: 'other',
} as const;

export const REJECTION_REASON_LABELS: Record<string, string> = {
  [REJECTION_REASON.NOT_QUALIFIED]: 'Not Qualified',
  [REJECTION_REASON.LOW_SCORE]: 'Low Score',
  [REJECTION_REASON.EXPERIENCE_MISMATCH]: 'Experience Mismatch',
  [REJECTION_REASON.POSITION_FILLED]: 'Position Filled',
  [REJECTION_REASON.OTHER]: 'Other',
};

/**
 * Canonical pipeline stages. Kept in sync with `services/hiring/stageTypes.ts`
 * and the `candidate_status_log` / `job_applications.current_stage` CHECK
 * constraints. These are the values the progression service actually writes.
 *
 * `candidates.current_status` is a MIRROR of `job_applications.current_stage`,
 * refreshed only when the candidate has exactly one application (see
 * `services/hiring/applicationService.ts`). For a candidate in several jobs at
 * once it is intentionally NOT authoritative — job-scoped surfaces must read
 * `job_applications` directly.
 */
export const PIPELINE_STAGE_STATUS = {
  APPLIED: 'Applied',
  SCREENING: 'Screening',
  SHORTLISTED: 'Shortlisted',
  ASSESSMENT: 'Assessment',
  TECHNICAL: 'Technical Round',
  HR: 'Interview',
  OFFER: 'Final Decision',
  HIRED: 'Hired',
} as const;

/** Terminal / parking outcomes — not pipeline stages. */
export const STAGE_OUTCOME_STATUS = {
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
  HOLD: 'Hold',
} as const;

/**
 * Legacy values still present on rows written before migration
 * `20261009_canonical_stage_vocabulary.sql`. Filtering on them alongside the
 * canonical values keeps the mirror column honest while the backfill runs and
 * for any row the rewrite skipped.
 */
export const LEGACY_STATUS_VALUES: readonly string[] = [
  'Technical Interview',
  'Managerial/HR',
  'HR Round',
  'HR Interview',
  'Offer',
  'Offered',
  'Interview Scheduled',
  'Interview Completed',
  'Pending',
];

export const STATUS_FILTER_MAP: Record<string, string | string[]> = {
  applied: CANDIDATE_STATUS.APPLIED,
  open: [
    CANDIDATE_STATUS.APPLIED,
    PIPELINE_STAGE_STATUS.SCREENING,
    PIPELINE_STAGE_STATUS.SHORTLISTED,
    PIPELINE_STAGE_STATUS.ASSESSMENT,
    PIPELINE_STAGE_STATUS.TECHNICAL,
    PIPELINE_STAGE_STATUS.HR,
    PIPELINE_STAGE_STATUS.OFFER,
  ],
  screening: CANDIDATE_STATUS.SCREENING,
  shortlisted: PIPELINE_STAGE_STATUS.SHORTLISTED,
  assessment: PIPELINE_STAGE_STATUS.ASSESSMENT,
  technical: [PIPELINE_STAGE_STATUS.TECHNICAL, CANDIDATE_STATUS.TECHNICAL_ROUND, 'Technical Interview'],
  // `interview` and `hr` are the same bucket now that Managerial/HR was renamed
  // to Interview. Both query params are kept so existing links keep working.
  interview: [PIPELINE_STAGE_STATUS.HR, 'Managerial/HR', CANDIDATE_STATUS.HR_ROUND],
  hr: [PIPELINE_STAGE_STATUS.HR, 'Managerial/HR', CANDIDATE_STATUS.HR_ROUND],
  final: PIPELINE_STAGE_STATUS.OFFER,
  // Resolved by the controller via interviewCandidateIds, NOT by a status
  // filter. It is deliberately absent here: an empty array previously made
  // `buildStatusFilterParam` a no-op, so this filter silently returned EVERY
  // candidate instead of the ones with interviews today.
  offer: PIPELINE_STAGE_STATUS.OFFER,
  offered: [CANDIDATE_STATUS.OFFERED, PIPELINE_STAGE_STATUS.OFFER],
  hired: CANDIDATE_STATUS.HIRED,
  rejected: CANDIDATE_STATUS.REJECTED,
  hold: STAGE_OUTCOME_STATUS.HOLD,
  withdrawn: STAGE_OUTCOME_STATUS.WITHDRAWN,
};

export const AGGREGATION_STATUS_GROUPS: Record<string, string[]> = {
  open: [
    CANDIDATE_STATUS.APPLIED,
    PIPELINE_STAGE_STATUS.SCREENING,
    PIPELINE_STAGE_STATUS.SHORTLISTED,
    PIPELINE_STAGE_STATUS.ASSESSMENT,
    PIPELINE_STAGE_STATUS.TECHNICAL,
    PIPELINE_STAGE_STATUS.HR,
    PIPELINE_STAGE_STATUS.OFFER,
  ],
  applied: [CANDIDATE_STATUS.APPLIED],
  screening: [CANDIDATE_STATUS.SCREENING],
  shortlisted: [PIPELINE_STAGE_STATUS.SHORTLISTED],
  assessment: [PIPELINE_STAGE_STATUS.ASSESSMENT],
  technical: [PIPELINE_STAGE_STATUS.TECHNICAL, CANDIDATE_STATUS.TECHNICAL_ROUND, 'Technical Interview'],
  interview: [PIPELINE_STAGE_STATUS.HR, 'Managerial/HR', CANDIDATE_STATUS.HR_ROUND],
  hr: [PIPELINE_STAGE_STATUS.HR, 'Managerial/HR', CANDIDATE_STATUS.HR_ROUND],
  offered: [CANDIDATE_STATUS.OFFERED, PIPELINE_STAGE_STATUS.OFFER],
  hired: [CANDIDATE_STATUS.HIRED],
  rejected: [CANDIDATE_STATUS.REJECTED],
  hold: [STAGE_OUTCOME_STATUS.HOLD],
};
