import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ErrorCodes } from './errorCodes';

type Source = 'body' | 'params' | 'query';

export function validate(schema: z.ZodSchema, source: Source = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const message = result.error.issues.map(i => i.message).join('; ');
      res.status(400).json({ success: false, code: ErrorCodes.VALIDATION_ERROR, error: message });
      return;
    }
    next();
  };
}

const nonEmptyString = z.string().min(1);

export const candidateStatusEnum = z.enum([
  'Applied', 'Screening', 'Technical Interview', 'HR Interview', 'Offer', 'Hired', 'Rejected',
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
