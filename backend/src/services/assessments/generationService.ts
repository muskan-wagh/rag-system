import { z } from 'zod';
import { chatCompletion } from '@/services/llm/client';
import { extractJson } from '@/utils/parse-llm-json';
import {
  validateQuestion,
  normalizeMcqOptions,
  type AssessmentQuestionType,
} from './validation';
import { logger } from '@/utils/logger';

/**
 * AI Assessment Generation service.
 *
 * Job-specific: the caller passes the Job/JD (loaded server-side from the
 * DB — never trust recruiter-supplied skill lists blindly) plus the
 * desired shape. The LLM returns structured JSON, validated with Zod
 * AND the existing builder `validateQuestion` gate before anything is
 * persisted. Output is always a DRAFT for recruiter review — this service
 * never publishes and never invites candidates.
 */

export const GENERATION_QUESTION_TYPES = ['mcq', 'coding', 'sql', 'subjective'] as const;
export type GenerationQuestionType = (typeof GENERATION_QUESTION_TYPES)[number];

export interface GenerationRequest {
  jobTitle: string;
  jobDescription: string;
  requiredSkills: string[];
  preferredSkills: string[];
  experienceLevel: string;
  educationRequirements: string;
  /** Desired counts per type, e.g. { mcq: 8, coding: 2 }. */
  questionTypes: Partial<Record<GenerationQuestionType, number>>;
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  /** Default marks per question when the model omits them. */
  defaultMarks?: number;
}

export interface NormalizedGeneratedQuestion {
  type: AssessmentQuestionType;
  title: string;
  prompt: string;
  payload: Record<string, unknown>;
  marks: number;
  skill_tag: string;
  is_required: boolean;
}

// ---------- AI JSON contract (Zod) ----------

/**
 * The model mirrors the schema template in the prompt, which lists every field
 * for every type. In practice it emits `"correctOption": null` on a
 * coding/SQL/subjective question rather than omitting the key.
 * `z.number().optional()` accepts `undefined` but REJECTS `null`, so one stray
 * null anywhere in the batch failed the ENTIRE generation:
 *
 *   AI assessment JSON failed contract validation
 *   [{"path":["questions",3,"correctOption"],"message":"expected number, received null"}]
 *
 * `null` therefore means "not applicable for this question type" and is
 * normalised to "absent" before validation. Required fields stay strict, so a
 * genuinely malformed response is still rejected.
 */
const optionalNumber = z.number().int().min(0).nullable().optional();
const optionalMarks = z.number().int().min(0).max(100).nullable().optional();
const optionalString = z.string().nullable().optional();

const aiTestCaseSchema = z.object({
  input: optionalString.default(''),
  expected_output: optionalString,
});

const aiQuestionSchema = z.object({
  type: z.enum(GENERATION_QUESTION_TYPES),
  prompt: z.string().min(1),
  title: optionalString.default(''),
  skill: optionalString.default(''),
  difficulty: optionalString.default(''),
  marks: optionalMarks,
  // mcq
  options: z.array(z.string()).nullable().optional().default([]),
  correctOption: optionalNumber,
  // coding
  language: optionalString.default(''),
  starter_code: optionalString.default(''),
  test_cases: z.array(aiTestCaseSchema).nullable().optional().default([]),
  // sql
  schema_ddl: optionalString.default(''),
  expected_query: optionalString.default(''),
  expected_result: z.unknown().optional(),
  // subjective
  rubric: optionalString.default(''),
});

/**
 * Drop `null` from optional keys before validation. Deliberately narrow: it
 * removes keys the model filled with "not applicable", and never invents
 * content.
 */
function normalizeAiQuestions(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== 'object') return parsed;
  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.questions)) return parsed;

  const stripNulls = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stripNulls);
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (v === null || v === undefined) continue;
        out[k] = stripNulls(v);
      }
      return out;
    }
    return value;
  };

  return { ...obj, questions: obj.questions.map(stripNulls) };
}

const aiResponseSchema = z.object({
  questions: z.array(aiQuestionSchema).min(1),
});

type AiQuestion = z.infer<typeof aiQuestionSchema>;

/** LLM function type — injectable so tests never hit the network. */
export type LlmFn = (
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options?: { temperature?: number; maxTokens?: number },
) => Promise<{ content: string; model: string }>;

export function totalRequestedCount(request: GenerationRequest): number {
  return (Object.values(request.questionTypes) as number[]).reduce(
    (sum, n) => sum + (Number(n) || 0),
    0,
  );
}

export function buildGenerationPrompt(request: GenerationRequest): {
  system: string;
  user: string;
} {
  const typeLines = (Object.entries(request.questionTypes) as Array<[string, number]>)
    .filter(([, n]) => Number(n) > 0)
    .map(([t, n]) => `- ${t}: ${n}`)
    .join('\n');
  const system =
    'You are an expert technical hiring assessor. Generate a fair, role-relevant candidate assessment. ' +
    'Return ONLY a single JSON object matching the requested schema — no markdown, no commentary.';
  const user = [
    `Role: ${request.jobTitle}`,
    `Experience level: ${request.experienceLevel || 'Not specified'}`,
    `Required skills: ${request.requiredSkills.join(', ') || 'None specified'}`,
    `Preferred skills: ${request.preferredSkills.join(', ') || 'None'}`,
    `Education requirements: ${request.educationRequirements || 'Not specified'}`,
    '',
    'Job description:',
    (request.jobDescription || '').slice(0, 6000),
    '',
    `Difficulty: ${request.difficulty}`,
    'Generate exactly this many questions per type:',
    typeLines || '- mcq: 5',
    '',
    'JSON schema (return exactly this shape):',
    '{"questions":[{"type":"mcq|coding|sql|subjective","prompt":"...","title":"...","skill":"...","difficulty":"easy|medium|hard","marks":2,',
    '"options":["a","b","c","d"],"correctOption":1,',
    '"language":"javascript","starter_code":"...","test_cases":[{"input":"...","expected_output":"..."}],',
    '"schema_ddl":"CREATE TABLE ...","expected_query":"SELECT ...","expected_result":"... or {...}",',
    '"rubric":"..."}]}',
    '',
    'Rules: mcq MUST have >=2 options and a correctOption index into options. ' +
      'coding MUST specify language, starter_code and >=1 test case with expected_output. ' +
      'sql MUST include schema_ddl and expected_query or expected_result. ' +
      'subjective MUST include a grading rubric. Keep prompts self-contained and unambiguous.',
  ].join('\n');
  return { system, user };
}

/** Convert one AI question into builder storage shape. */
export function normalizeGeneratedQuestion(
  q: AiQuestion,
  defaultMarks: number,
): NormalizedGeneratedQuestion {
  const skill = (q.skill || '').trim();
  const marks = q.marks ?? defaultMarks;
  if (q.type === 'mcq') {
    const options = normalizeMcqOptions(q.options);
    const correct = options[q.correctOption ?? -1];
    return {
      type: 'mcq',
      title: (q.title || '').trim(),
      prompt: q.prompt.trim(),
      payload: {
        options,
        correct_option_id: correct ? correct.id : '',
      },
      marks,
      skill_tag: skill,
      is_required: true,
    };
  }
  if (q.type === 'coding') {
    return {
      type: 'coding',
      title: (q.title || '').trim(),
      prompt: q.prompt.trim(),
      payload: {
        language: (q.language || 'javascript').trim() || 'javascript',
        starter_code: q.starter_code,
        test_cases: (q.test_cases ?? []).map((tc) => ({
          input: tc.input || '',
          expected_output: tc.expected_output,
        })),
      },
      marks,
      skill_tag: skill,
      is_required: true,
    };
  }
  if (q.type === 'sql') {
    const payload: Record<string, unknown> = { schema_ddl: q.schema_ddl };
    if (q.expected_query && q.expected_query.trim()) payload.expected_query = q.expected_query;
    if (q.expected_result !== undefined && q.expected_result !== null && q.expected_result !== '') {
      payload.expected_result = q.expected_result;
    }
    return {
      type: 'sql',
      title: (q.title || '').trim(),
      prompt: q.prompt.trim(),
      payload,
      marks,
      skill_tag: skill,
      is_required: true,
    };
  }
  return {
    type: 'subjective',
    title: (q.title || '').trim(),
    prompt: q.prompt.trim(),
    payload: { rubric: q.rubric },
    marks,
    skill_tag: skill,
    is_required: true,
  };
}

export interface GenerationResult {
  questions: NormalizedGeneratedQuestion[];
  model: string;
  /** Valid AI questions dropped by the builder gate (for logging/debugging). */
  dropped: number;
}

/**
 * Generate draft questions. Throws when the model output yields zero
 * publish-valid questions. Pure apart from the injectable LLM call.
 */
export async function generateAssessmentQuestions(
  request: GenerationRequest,
  llm: LlmFn = chatCompletion,
): Promise<GenerationResult> {
  const requested = totalRequestedCount(request);
  if (requested <= 0) {
    throw new Error('Request at least 1 question across mcq/coding/sql/subjective.');
  }
  if (requested > 50) {
    throw new Error('Cannot generate more than 50 questions in one request.');
  }
  const defaultMarks = request.defaultMarks ?? 2;
  let validated: { questions: AiQuestion[] };

  const { system, user } = buildGenerationPrompt(request);
  const response = await llm(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { temperature: 0.4, maxTokens: 8192 },
  );

  const parsed = extractJson<unknown>(response.content || '');
  if (!parsed) {
    throw new Error('AI did not return parseable JSON. Please try again.');
  }

  const normalized = normalizeAiQuestions(parsed);
  const contract = aiResponseSchema.safeParse(normalized);
  if (!contract.success) {
    // Salvage per question rather than discarding the whole batch: a single
    // unusable question must not cost the recruiter the other eight. Each
    // question is validated on its own; the batch only fails when NOTHING
    // survives, which is the honest signal to report "try again".
    const rawQuestions =
      normalized && typeof normalized === 'object'
        ? (normalized as { questions?: unknown[] }).questions
        : undefined;
    if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
      logger.warn('AI assessment JSON failed contract validation', {
        issues: contract.error.issues.slice(0, 5),
      });
      throw new Error('AI returned an unexpected question format. Please try again.');
    }

    const accepted: AiQuestion[] = [];
    const rejected: string[] = [];
    rawQuestions.forEach((q, index) => {
      const one = aiQuestionSchema.safeParse(q);
      if (one.success) accepted.push(one.data);
      else rejected.push(`#${index} ${one.error.issues[0]?.message ?? 'invalid'}`);
    });

    if (accepted.length === 0) {
      logger.warn('AI assessment JSON failed contract validation', { issues: rejected.slice(0, 5) });
      throw new Error('AI returned an unexpected question format. Please try again.');
    }

    logger.warn('AI assessment JSON partially invalid; keeping usable questions', {
      kept: accepted.length,
      dropped: rejected.length,
      issues: rejected.slice(0, 5),
    });
    validated = { questions: accepted };
  } else {
    validated = contract.data;
  }

  const questions: NormalizedGeneratedQuestion[] = [];
  let dropped = 0;
  for (const ai of validated.questions) {
    const normalized = normalizeGeneratedQuestion(ai, defaultMarks);
    const errors = validateQuestion({
      type: normalized.type,
      title: normalized.title,
      prompt: normalized.prompt,
      payload: normalized.payload,
      marks: normalized.marks,
      skill_tag: normalized.skill_tag,
      is_required: normalized.is_required,
    });
    if (errors.length > 0) {
      dropped += 1;
      logger.warn('Dropping AI question that failed builder validation', {
        type: normalized.type,
        errors: errors.slice(0, 3),
      });
      continue;
    }
    questions.push(normalized);
  }

  if (questions.length === 0) {
    throw new Error('AI questions failed validation. Please try again.');
  }
  return { questions, model: response.model, dropped };
}
