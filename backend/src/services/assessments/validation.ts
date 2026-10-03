/**
 * Pure validators for the recruiter-side Assessment Builder.
 *
 * No DB, no network — safe to unit-test. The controller reuses these so
 * frontend error messages and publish gates share one source of truth.
 */

export const QUESTION_TYPES = ['mcq', 'coding', 'sql', 'subjective'] as const;
export type AssessmentQuestionType = (typeof QUESTION_TYPES)[number];

export function isQuestionType(value: unknown): value is AssessmentQuestionType {
  return typeof value === 'string' && (QUESTION_TYPES as readonly string[]).includes(value);
}

export interface McqOption {
  id: string;
  text: string;
}

export interface QuestionInput {
  type: unknown;
  title?: unknown;
  prompt?: unknown;
  payload?: unknown;
  marks?: unknown;
  skill_tag?: unknown;
  is_required?: unknown;
}

export interface StoredQuestion {
  id: string;
  type: string;
  prompt: string;
  payload: Record<string, unknown>;
  marks: number;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Normalize MCQ options: accepts string[] or [{id?, text}]. Assigns stable ids when missing. */
export function normalizeMcqOptions(raw: unknown): McqOption[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry, index) => {
    if (typeof entry === 'string') {
      return { id: `opt-${index + 1}`, text: entry.trim() };
    }
    const rec = asRecord(entry);
    const text = typeof rec.text === 'string' ? rec.text.trim() : '';
    const id = typeof rec.id === 'string' && rec.id.trim()
      ? rec.id.trim()
      : `opt-${index + 1}`;
    return { id, text };
  });
}

function validateMcqPayload(payload: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const options = normalizeMcqOptions(payload.options);
  if (options.length < 2) {
    errors.push('MCQ needs at least 2 options.');
  }
  const emptyOption = options.findIndex((o) => !o.text);
  if (emptyOption !== -1) {
    errors.push(`MCQ option ${emptyOption + 1} has empty text.`);
  }
  const ids = options.map((o) => o.id);
  if (new Set(ids).size !== ids.length) {
    errors.push('MCQ option ids must be unique.');
  }
  const correct = payload.correct_option_id;
  if (typeof correct !== 'string' || !correct.trim()) {
    errors.push('MCQ needs a correct option.');
  } else if (options.length > 0 && !ids.includes(correct.trim())) {
    errors.push('MCQ correct option must match one of the options.');
  }
  return errors;
}

function validateCodingPayload(payload: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (typeof payload.language !== 'string' || !payload.language.trim()) {
    errors.push('Coding question needs a programming language.');
  }
  if (typeof payload.starter_code !== 'string' || !payload.starter_code.trim()) {
    errors.push('Coding question needs starter code.');
  }
  const cases = payload.test_cases;
  if (!Array.isArray(cases) || cases.length === 0) {
    errors.push('Coding question needs at least 1 test case.');
  } else {
    cases.forEach((tc, index) => {
      const rec = asRecord(tc);
      if (typeof rec.expected_output !== 'string') {
        errors.push(`Coding test case ${index + 1} needs an expected_output string.`);
      }
      if (rec.input !== undefined && typeof rec.input !== 'string') {
        errors.push(`Coding test case ${index + 1} input must be a string.`);
      }
    });
  }
  return errors;
}

function validateSqlPayload(payload: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const schema = payload.schema_ddl ?? payload.schema;
  if (typeof schema !== 'string' || !schema.trim()) {
    errors.push('SQL question needs a database schema definition.');
  }
  const query = payload.expected_query ?? payload.expected_sql;
  const result = payload.expected_result;
  const hasQuery = typeof query === 'string' && query.trim().length > 0;
  const hasResult = typeof result === 'string' ? result.trim().length > 0 : result !== undefined && result !== null;
  if (!hasQuery && !hasResult) {
    errors.push('SQL question needs an expected query or an expected result.');
  }
  return errors;
}

function validateSubjectivePayload(payload: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (typeof payload.rubric !== 'string' || !payload.rubric.trim()) {
    errors.push('Subjective question needs an evaluation rubric.');
  }
  return errors;
}

/**
 * Editor-level validation (correction #12): required fields per question type.
 * Returns a list of human-readable errors; empty means valid.
 */
export function validateQuestion(input: QuestionInput): string[] {
  const errors: string[] = [];

  if (!isQuestionType(input.type)) {
    return [`Invalid question type. Must be one of: ${QUESTION_TYPES.join(', ')}.`];
  }

  if (typeof input.prompt !== 'string' || !input.prompt.trim()) {
    errors.push('Question prompt is required.');
  }

  if (input.marks === undefined || input.marks === null || input.marks === '') {
    errors.push('Marks are required.');
  } else {
    const marks = Number(input.marks);
    if (!Number.isFinite(marks) || marks < 0) {
      errors.push('Marks must be a number >= 0.');
    }
  }

  const payload = asRecord(input.payload);
  switch (input.type) {
    case 'mcq':
      errors.push(...validateMcqPayload(payload));
      break;
    case 'coding':
      errors.push(...validateCodingPayload(payload));
      break;
    case 'sql':
      errors.push(...validateSqlPayload(payload));
      break;
    case 'subjective':
      errors.push(...validateSubjectivePayload(payload));
      break;
  }

  return errors;
}

export interface PublishInput {
  name?: unknown;
  passing_score?: unknown;
  available_from?: unknown;
  available_until?: unknown;
  questions: StoredQuestion[];
}

/** Parse an ISO date-ish value; returns null for empty, Invalid Date as NaN time. */
function parseWindowEdge(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const time = new Date(String(value)).getTime();
  return Number.isNaN(time) ? NaN : time;
}

/**
 * Publish gate (correction #7). Every rule is checked server-side even if the
 * frontend also validates — publishing is the trust boundary.
 */
export function validatePublish(input: PublishInput): string[] {
  const errors: string[] = [];

  if (typeof input.name !== 'string' || !input.name.trim()) {
    errors.push('Assessment name is required before publishing.');
  }

  const questions = Array.isArray(input.questions) ? input.questions : [];
  if (questions.length === 0) {
    errors.push('Add at least 1 question before publishing.');
  }

  let total = 0;
  const seenIds = new Set<string>();
  for (const q of questions) {
    if (seenIds.has(q.id)) {
      errors.push('Question ordering contains duplicate question IDs.');
      break;
    }
    seenIds.add(q.id);

    if (!isQuestionType(q.type)) {
      errors.push(`Question has invalid type: ${String(q.type)}.`);
      continue;
    }
    if (typeof q.marks !== 'number' || !Number.isFinite(q.marks) || q.marks < 0) {
      errors.push('Every question needs marks >= 0.');
      continue;
    }
    total += q.marks;
    const perQuestion = validateQuestion({
      type: q.type,
      prompt: q.prompt,
      payload: q.payload,
      marks: q.marks,
    });
    for (const e of perQuestion) {
      errors.push(e);
      break; // one representative error per bad question keeps the response readable
    }
  }

  if (questions.length > 0 && total <= 0) {
    errors.push('Total marks must be greater than 0.');
  }

  const passing = Number(input.passing_score ?? 0);
  if (!Number.isFinite(passing) || passing < 0) {
    errors.push('Passing score must be a number >= 0.');
  } else if (questions.length > 0 && total > 0 && passing > total) {
    errors.push(`Passing score (${passing}) cannot exceed total marks (${total}).`);
  }

  const from = parseWindowEdge(input.available_from);
  const until = parseWindowEdge(input.available_until);
  if (Number.isNaN(from) || Number.isNaN(until)) {
    errors.push('Availability window dates must be valid datetimes.');
  } else if (from !== null && until !== null && from >= until) {
    errors.push('available_from must be earlier than available_until.');
  }

  return [...new Set(errors)];
}

/** Shared totals helper for detail responses and list rows. */
export function questionTotals(questions: Array<{ marks: number }>): {
  totalQuestions: number;
  totalMarks: number;
} {
  return {
    totalQuestions: questions.length,
    totalMarks: questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0),
  };
}

/**
 * Reorder gate: orderedIds must be exactly the current question id set —
 * same length, same members, no duplicates.
 */
export function validateReorder(currentIds: string[], orderedIds: unknown): string[] {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return ['orderedIds must be a non-empty array of question IDs.'];
  }
  if (orderedIds.some((id) => typeof id !== 'string')) {
    return ['orderedIds must contain only question ID strings.'];
  }
  if (new Set(orderedIds).size !== orderedIds.length) {
    return ['orderedIds contains duplicate question IDs.'];
  }
  const current = new Set(currentIds);
  if (orderedIds.length !== currentIds.length || !(orderedIds as string[]).every((id) => current.has(id))) {
    return ['orderedIds must contain exactly the current question IDs.'];
  }
  return [];
}
