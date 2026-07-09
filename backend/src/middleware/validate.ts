import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ErrorCodes } from './errorCodes';
import { logger } from '@/utils/logger';

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

export const candidateStatusEnum = z.enum([
  'Pending', 'Shortlisted', 'Interview', 'Offer', 'Hired', 'Rejected',
  'Applied', 'Screening', 'Technical Interview', 'HR Interview',
]);

export const jdTextSchema = z.object({
  jdText: nonEmptyString,
});

export const searchSchema = z.object({
  jdText: nonEmptyString,
  limit: z.number().int().positive().max(100).optional(),
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
