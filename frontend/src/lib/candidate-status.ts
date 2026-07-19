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
  [CANDIDATE_STATUS.APPLIED.toLowerCase()]: "bg-[#170C2B]/10 text-[#170C2B] border-[#170C2B]/20",
  [CANDIDATE_STATUS.SHORTLISTED.toLowerCase()]: "bg-violet-50 text-violet-700 border-violet-200",
  [CANDIDATE_STATUS.SCREENING.toLowerCase()]: "bg-amber-50 text-amber-700 border-amber-200",
  [CANDIDATE_STATUS.INTERVIEW_SCHEDULED.toLowerCase()]: "bg-amber-50 text-amber-700 border-amber-200",
  [CANDIDATE_STATUS.INTERVIEW_COMPLETED.toLowerCase()]: "bg-amber-50 text-amber-700 border-amber-200",
  [CANDIDATE_STATUS.TECHNICAL_ROUND.toLowerCase()]: "bg-amber-50 text-amber-700 border-amber-200",
  [CANDIDATE_STATUS.HR_ROUND.toLowerCase()]: "bg-amber-50 text-amber-700 border-amber-200",
  [CANDIDATE_STATUS.OFFERED.toLowerCase()]: "bg-green-50 text-green-700 border-green-200",
  [CANDIDATE_STATUS.HIRED.toLowerCase()]: "bg-green-50 text-green-700 border-green-200",
  [CANDIDATE_STATUS.REJECTED.toLowerCase()]: "bg-red-50 text-red-700 border-red-200",
};

export function getStatusColor(status?: string): string {
  if (!status) return "bg-gray-50 text-gray-700 border-gray-200";
  return STATUS_COLORS[status.toLowerCase()] ?? "bg-gray-50 text-gray-700 border-gray-200";
}
