export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  STORAGE_ERROR: 'STORAGE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  AI_ERROR: 'AI_ERROR',
  QDRANT_ERROR: 'QDRANT_ERROR',
  /**
   * The job is closed and the attempted action would create new recruitment
   * activity. Carries `details.overrideAllowed` so a client can tell "blocked,
   * but a recruiter can enable an override" from "blocked outright".
   */
  JOB_CLOSED: 'JOB_CLOSED',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
