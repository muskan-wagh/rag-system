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

export const STATUS_FILTER_MAP: Record<string, string | string[]> = {
  applied: CANDIDATE_STATUS.APPLIED,
  open: [CANDIDATE_STATUS.APPLIED, CANDIDATE_STATUS.SHORTLISTED],
  screening: CANDIDATE_STATUS.SCREENING,
  interview: CANDIDATE_STATUS.INTERVIEW_SCHEDULED,
  'interviews-today': [],
  offer: CANDIDATE_STATUS.OFFERED,
  offered: CANDIDATE_STATUS.OFFERED,
  hired: CANDIDATE_STATUS.HIRED,
  rejected: CANDIDATE_STATUS.REJECTED,
};

export const AGGREGATION_STATUS_GROUPS: Record<string, string[]> = {
  open: [CANDIDATE_STATUS.APPLIED, CANDIDATE_STATUS.SHORTLISTED],
  applied: [CANDIDATE_STATUS.APPLIED],
  screening: [CANDIDATE_STATUS.SCREENING],
  interview: [CANDIDATE_STATUS.INTERVIEW_SCHEDULED, CANDIDATE_STATUS.INTERVIEW, CANDIDATE_STATUS.INTERVIEW_COMPLETED, CANDIDATE_STATUS.TECHNICAL_ROUND, CANDIDATE_STATUS.HR_ROUND],
  offered: [CANDIDATE_STATUS.OFFERED],
  hired: [CANDIDATE_STATUS.HIRED],
  rejected: [CANDIDATE_STATUS.REJECTED],
};
