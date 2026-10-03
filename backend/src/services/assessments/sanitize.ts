/**
 * Candidate-safe question views.
 * SINGLE choke point for hidden-data stripping — every candidate
 * route MUST pass questions through sanitizeQuestion().
 * Never expose: correct answers, hidden tests, expected outputs,
 * reference solutions, private rubrics, recruiter notes.
 */

interface RawQuestion {
  id: string;
  assessment_id?: string;
  type: string;
  position: number;
  title: string;
  prompt: string;
  payload: Record<string, unknown>;
  marks: number;
  skill_tag?: string;
  is_required?: boolean;
}

export interface SafeQuestion extends Omit<RawQuestion, 'payload'> {
  payload: Record<string, unknown>;
}

interface TestCase {
  input?: string;
  expected_output?: string;
  is_hidden?: boolean;
  is_sample?: boolean;
  [key: string]: unknown;
}

function sanitizeTestCases(cases: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(cases)) return [];
  return (cases as TestCase[])
    .filter((tc) => tc && tc.is_hidden !== true)
    .map((tc) => ({
      // Visible cases expose input only; expected output stays server-side
      // so Run cannot be used to harvest hidden expectations.
      input: typeof tc.input === 'string' ? tc.input : '',
      is_sample: tc.is_sample === true,
    }));
}

/** Strip recruiter-only fields from a single question payload. */
export function sanitizeQuestion(question: RawQuestion): SafeQuestion {
  const payload = { ...(question.payload || {}) } as Record<string, unknown>;

  switch (question.type) {
    case 'mcq': {
      const options = Array.isArray(payload.options) ? payload.options : [];
      payload.options = options.map((o: unknown) => {
        if (typeof o === 'string') return { text: o };
        const rec = (o || {}) as Record<string, unknown>;
        return { id: rec.id, text: rec.text };
      });
      delete payload.correct_option_id;
      delete payload.correct_answer;
      delete payload.explanation;
      break;
    }
    case 'coding': {
      payload.test_cases = sanitizeTestCases(payload.test_cases);
      delete payload.expected_output;
      delete payload.reference_solution;
      delete payload.solution;
      delete payload.hidden_tests;
      break;
    }
    case 'sql': {
      delete payload.expected_query;
      delete payload.expected_sql;
      delete payload.expected_answer;
      delete payload.expected_result;
      delete payload.reference_solution;
      break;
    }
    case 'subjective': {
      delete payload.rubric;
      delete payload.model_answer;
      delete payload.expected_answer;
      break;
    }
    default:
      break;
  }

  // Never leak internal notes/weights.
  delete payload.recruiter_notes;
  delete payload.private_notes;
  delete payload.weight;

  return { ...question, payload };
}

export function sanitizeQuestions(questions: RawQuestion[]): SafeQuestion[] {
  return questions.map(sanitizeQuestion);
}

/** Assert a candidate response contains no hidden fields (test helper + runtime guard). */
export function containsHiddenData(obj: unknown): string[] {
  const found: string[] = [];
  const BANNED = [
    'correct_option_id',
    'correct_answer',
    'expected_output',
    'expected_query',
    'expected_result',
    'expected_answer',
    'reference_solution',
    'hidden_tests',
    'rubric',
    'model_answer',
    'recruiter_notes',
    'private_notes',
  ];
  const seen = new Set<unknown>();
  function walk(node: unknown): void {
    if (!node || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (BANNED.includes(k)) found.push(k);
      walk(v);
    }
  }
  walk(obj);
  return [...new Set(found)];
}
