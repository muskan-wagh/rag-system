/**
 * Assessment auto-scoring (correction #4, #13).
 *
 * - passing_score is a PERCENTAGE (0-100).
 *   percentage = score / max_score * 100
 *   passed = percentage >= passing_score
 * - Persist score, max_score, percentage, passed.
 * - MCQ: exact match on correct_option_id.
 * - Coding: hidden tests executed server-side via evaluateCodeSubmission
 *   path only (never via Run). Score = marks * hiddenPassed/hiddenTotal.
 * - SQL: normalized RESULT-SET comparison (not raw string match);
 *   ordering enforced only when the question requires it.
 * - Subjective: score stays NULL until manual review — never implicit
 *   zero. Objective eligibility uses objective-only totals unless the
 *   assessment explicitly configures otherwise.
 */

export interface ScoreInput {
  type: string;
  marks: number;
  payload: Record<string, unknown>;
  answer: Record<string, unknown> | null;
  /** Coding only: hidden-test outcomes from server-side execution. */
  hiddenPassed?: number;
  hiddenTotal?: number;
}

export interface QuestionScore {
  score: number | null;
  maxScore: number;
  isCorrect: boolean | null;
}

/** Normalize a SQL result set for comparison: trim, collapse whitespace, lowercase keywords. */
export function normalizeSqlResultSet(value: unknown, respectOrder: boolean): string {
  const rows = Array.isArray(value) ? value : [value];
  const norm = rows.map((r) =>
    String(r ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase(),
  );
  if (!respectOrder) norm.sort();
  return JSON.stringify(norm);
}

/** Parse a stored/candidate result that may be JSON or CSV-ish text. */
export function parseResultSet(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed: unknown = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
    }
  }
  return raw === undefined || raw === null ? [] : [raw];
}

function questionRequiresOrder(payload: Record<string, unknown>): boolean {
  if (payload.require_order === true) return true;
  const text = `${String(payload.prompt_hint || '')} ${String(payload.order_note || '')}`.toLowerCase();
  return /order\s+by|sorted|in\s+order/.test(text);
}

export function scoreQuestion(input: ScoreInput): QuestionScore {
  const maxScore = Number(input.marks) || 0;
  const answer = input.answer || {};

  switch (input.type) {
    case 'mcq': {
      const correct = String(input.payload.correct_option_id || '').trim();
      const given = String(
        (answer as Record<string, unknown>).selected_option_id ??
          (answer as Record<string, unknown>).selectedOptionId ??
          '',
      ).trim();
      if (!given) return { score: 0, maxScore, isCorrect: false };
      const ok = given === correct;
      return { score: ok ? maxScore : 0, maxScore, isCorrect: ok };
    }
    case 'coding': {
      const total = input.hiddenTotal ?? 0;
      const passed = input.hiddenPassed ?? 0;
      if (total <= 0) return { score: 0, maxScore, isCorrect: false };
      const ratio = Math.max(0, Math.min(1, passed / total));
      const score = Math.round(maxScore * ratio * 100) / 100;
      return { score, maxScore, isCorrect: ratio === 1 };
    }
    case 'sql': {
      const expected = parseResultSet(
        input.payload.expected_result ?? input.payload.expected_query_result,
      );
      const given = parseResultSet(
        (answer as Record<string, unknown>).result ??
          (answer as Record<string, unknown>).rows ??
          (answer as Record<string, unknown>).query_result,
      );
      // Empty submission never passes.
      if (given.length === 0) return { score: 0, maxScore, isCorrect: false };
      const respectOrder = questionRequiresOrder(input.payload);
      const ok =
        normalizeSqlResultSet(given, respectOrder) === normalizeSqlResultSet(expected, respectOrder);
      return { score: ok ? maxScore : 0, maxScore, isCorrect: ok };
    }
    case 'subjective': {
      // Manual review only — NULL, never zero (correction #13).
      return { score: null, maxScore, isCorrect: null };
    }
    default:
      return { score: 0, maxScore, isCorrect: false };
  }
}

export interface TotalsInput {
  scores: QuestionScore[];
  /** When false (default), subjective (NULL) questions are excluded from max. */
  includeSubjectiveInMax?: boolean;
}

export function computeTotals(input: TotalsInput): {
  score: number;
  maxScore: number;
  percentage: number;
  answeredObjective: number;
  objectiveCount: number;
} {
  let score = 0;
  let maxScore = 0;
  let answeredObjective = 0;
  let objectiveCount = 0;
  for (const s of input.scores) {
    if (s.score === null) {
      // Subjective pending review: excluded unless explicitly configured.
      if (input.includeSubjectiveInMax) maxScore += s.maxScore;
      continue;
    }
    objectiveCount += 1;
    answeredObjective += 1;
    score += s.score;
    maxScore += s.maxScore;
  }
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 10000) / 100 : 0;
  return { score, maxScore, percentage, answeredObjective, objectiveCount };
}

/** Percentage-based pass rule (correction #4). */
export function isPassing(percentage: number, passingScorePercent: number): boolean {
  const bar = Number(passingScorePercent) || 0;
  return percentage >= bar;
}
