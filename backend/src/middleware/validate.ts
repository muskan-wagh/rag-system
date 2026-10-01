import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ErrorCodes } from './errorCodes';
import { logger } from '@/utils/logger';
import { CANDIDATE_STATUS_VALUES } from '@/constants/candidateStatus';

type Source = 'body' | 'params' | 'query';

export function validate(schema: z.ZodSchema, source: Source = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const message = result.error.issues.map(i => `${i.path.length ? i.path.join('.') + ': ' : ''}${i.message}`).join('; ');
      logger.warn('Validation failed', { source, path: req.path, params: req.params, method: req.method, issues: result.error.issues });
      res.status(400).json({ success: false, code: ErrorCodes.VALIDATION_ERROR, error: message });
      return;
    }
    next();
  };
}

const nonEmptyString = z.string().min(1);

export const candidateStatusEnum = z.enum(CANDIDATE_STATUS_VALUES as [string, ...string[]]);

export const interviewTypeEnum = z.enum(['google_meet','zoom','ms_teams','phone','in_person']);

export const scheduleInterviewSchema = z.object({
  scheduledDate: z.string().min(1),
  scheduledTime: z.string().min(1),
  interviewType: interviewTypeEnum,
  interviewerName: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

export const updateInterviewSchema = z.object({
  scheduledDate: z.string().optional(),
  scheduledTime: z.string().optional(),
  interviewType: interviewTypeEnum.optional(),
  interviewerName: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['scheduled','completed','cancelled']).optional(),
});

export const rejectCandidateSchema = z.object({
  reason: z.enum(['not_qualified','low_score','experience_mismatch','position_filled','other']),
  notes: z.string().optional().default(''),
});

export const makeOfferSchema = z.object({
  salary: z.number().positive().optional(),
  joiningDate: z.string().optional(),
  notes: z.string().optional().default(''),
});

export const jdTextSchema = z.object({
  jdText: nonEmptyString,
});

export const searchSchema = z.object({
  jdText: nonEmptyString,
  limit: z.number().int().positive().max(100).optional(),
  page: z.number().int().positive().optional(),
  filters: z.object({
    minExperience: z.number().min(0).optional(),
    maxExperience: z.number().min(0).optional(),
    skills: z.array(z.string()).optional(),
    educationLevel: z.string().optional(),
  }).optional(),
  explain: z.boolean().optional(),
});

export const compareSchema = z.object({
  jdText: nonEmptyString,
  candidateIds: z.array(z.string()).min(2),
});

export const batchSchema = z.object({
  ids: z.array(z.string()).min(1),
});

export const updateStatusSchema = z.object({
  status: candidateStatusEnum,
});

export const addNoteSchema = z.object({
  noteText: nonEmptyString,
});

export const idParamSchema = z.object({
  id: nonEmptyString,
});

export const sendGmailOutreachSchema = z.object({
  to: z.string().email('Invalid recipient email address'),
  subject: z.string().min(1, 'Subject is required').max(200),
  body: z.string().min(1, 'Email body is required').max(10000),
  html: z.string().max(50000).optional(),
  replyTo: z.string().email('Invalid Reply-To email address').optional(),
  // Event-specific idempotency key (optional). Same key + same recruiter =
  // one send; omit for each-send-is-a-new-event semantics.
  idempotencyKey: z.string().min(8).max(200).optional(),
});

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const uploadedFileSchema = z.object({
  fieldname: z.literal('resume'),
  originalname: z.string().min(1, 'File must have a name'),
  mimetype: z.enum(ALLOWED_MIME_TYPES, {
    error: 'Unsupported file format. Please upload a PDF or DOCX file.',
  }),
  size: z.number().max(MAX_FILE_SIZE, 'File too large. Maximum size is 5MB.'),
  buffer: z.instanceof(Buffer),
});

/**
 * Middleware: validates the uploaded file (set by multer) using Zod.
 * Must be placed AFTER upload.single('resume') in the middleware chain.
 */
export function validateUploadedFile(req: Request, res: Response, next: NextFunction): void {
  const file = req.file;
  if (!file) {
    res.status(400).json({
      success: false,
      code: ErrorCodes.VALIDATION_ERROR,
      error: 'No file uploaded. Please attach a PDF or DOCX resume.',
    });
    return;
  }

  const result = uploadedFileSchema.safeParse(file);
  if (!result.success) {
    const message = result.error.issues.map(i => i.message).join('; ');
    logger.warn('File validation failed', { path: req.path, issues: result.error.issues });
    res.status(400).json({
      success: false,
      code: ErrorCodes.VALIDATION_ERROR,
      error: message,
    });
    return;
  }

  next();
}

// === RECRUITER ASSESSMENT BUILDER (shapes only — semantic rules live in
// services/assessments/validation.ts so publish gates share one source) ===

export const questionTypeEnum = z.enum(['mcq', 'coding', 'sql', 'subjective']);

const assessmentSettingsSchema = z.object({
  randomize_questions: z.boolean().optional(),
  allow_revisit: z.boolean().optional(),
  auto_submit: z.boolean().optional(),
}).optional();

const newJobSchema = z.object({
  title: z.string().min(1, 'Job title is required').max(200),
  description: z.string().max(5000).optional().default(''),
}).optional();

const assessmentFieldsSchema = z.object({
  name: z.string().max(200).optional().default(''),
  description: z.string().max(10000).optional().default(''),
  instructions: z.string().max(20000).optional().default(''),
  duration_minutes: z.number().int().positive('Duration must be a positive number of minutes').max(1440).optional(),
  passing_score: z.number().min(0, 'Passing score must be >= 0').optional(),
  skills: z.array(z.string().max(100)).max(50).optional(),
  settings: assessmentSettingsSchema,
  available_from: z.string().max(100).optional(),
  available_until: z.string().max(100).optional(),
});

export const createJobSchema = z.object({
  title: z.string().min(1, 'Job title is required').max(200),
  description: z.string().max(5000).optional().default(''),
  upload_session_id: z.string().min(1).optional(),
});

export const createAssessmentSchema = assessmentFieldsSchema.extend({
  job_id: z.string().min(1).optional(),
  new_job: newJobSchema,
});

export const updateAssessmentSchema = assessmentFieldsSchema.extend({
  job_id: z.string().min(1).nullable().optional(),
  new_job: newJobSchema,
});

export const assessmentIdParamSchema = z.object({
  assessmentId: nonEmptyString,
});

export const assessmentQuestionParamSchema = z.object({
  assessmentId: nonEmptyString,
  questionId: nonEmptyString,
});

export const questionPayloadSchema = z.object({
  type: questionTypeEnum,
  title: z.string().max(500).optional().default(''),
  prompt: z.string().max(20000).optional().default(''),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
  marks: z.number().optional().default(1),
  skill_tag: z.string().max(100).optional().default(''),
  is_required: z.boolean().optional().default(true),
});

export const reorderQuestionsSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1, 'orderedIds must list every question ID').max(500),
});

export const createInvitesSchema = z.object({
  candidateIds: z.array(z.string().min(1)).min(1, 'Select at least one candidate').max(100),
});

export const eligibleQuerySchema = z.object({
  filter: z.enum(['eligible', 'all']).optional().default('eligible'),
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().max(200).optional(),
});
