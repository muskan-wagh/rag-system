export const CANDIDATE_STATUS = {
  APPLIED: 'Applied',
  SHORTLISTED: 'Shortlisted',
  SCREENING: 'Screening',
  INTERVIEW_SCHEDULED: 'Interview Scheduled',
  INTERVIEW_COMPLETED: 'Interview Completed',
  TECHNICAL_ROUND: 'Technical Round',
  HR_ROUND: 'HR Round',
  OFFERED: 'Offered',
  HIRED: 'Hired',
  REJECTED: 'Rejected',
} as const;

export const STATUS_COLORS: Record<string, string> = {
  [CANDIDATE_STATUS.APPLIED.toLowerCase()]: "bg-zinc-100 text-zinc-700 border-zinc-200",
  [CANDIDATE_STATUS.SHORTLISTED.toLowerCase()]: "bg-violet-50 text-violet-700 border-violet-200",
  [CANDIDATE_STATUS.SCREENING.toLowerCase()]: "bg-orange-50 text-orange-700 border-orange-200",
  [CANDIDATE_STATUS.INTERVIEW_SCHEDULED.toLowerCase()]: "bg-yellow-50 text-yellow-700 border-yellow-200",
  [CANDIDATE_STATUS.INTERVIEW_COMPLETED.toLowerCase()]: "bg-yellow-50 text-yellow-700 border-yellow-200",
  [CANDIDATE_STATUS.TECHNICAL_ROUND.toLowerCase()]: "bg-yellow-50 text-yellow-700 border-yellow-200",
  [CANDIDATE_STATUS.HR_ROUND.toLowerCase()]: "bg-yellow-50 text-yellow-700 border-yellow-200",
  [CANDIDATE_STATUS.OFFERED.toLowerCase()]: "bg-green-50 text-success border-success",
  [CANDIDATE_STATUS.HIRED.toLowerCase()]: "bg-green-50 text-success border-success",
  [CANDIDATE_STATUS.REJECTED.toLowerCase()]: "bg-red-50 text-red-700 border-red-200",
};

export function getStatusColor(status?: string): string {
  if (!status) return "bg-gray-50 text-gray-700 border-gray-200";
  return STATUS_COLORS[status.toLowerCase()] ?? "bg-gray-50 text-gray-700 border-gray-200";
}
