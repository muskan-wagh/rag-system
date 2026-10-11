import { describe, it, expect } from 'vitest';
import {
  scoreQuestion,
  computeTotals,
  isPassing,
  normalizeSqlText,
  normalizeSqlResultSet,
  parseResultSet,
} from '@/services/assessments/scoring';

const MCQ_PAYLOAD = {
  options: [
    { id: 'a', text: 'One' },
    { id: 'b', text: 'Two' },
  ],
  correct_option_id: 'b',
};

describe('MCQ scoring', () => {
  it('awards full marks for the correct option', () => {
    const r = scoreQuestion({
      type: 'mcq',
      marks: 3,
      payload: MCQ_PAYLOAD,
      answer: { selected_option_id: 'b' },
    });
    expect(r).toEqual({ score: 3, maxScore: 3, isCorrect: true });
  });

  it('awards zero for a wrong option', () => {
    const r = scoreQuestion({
      type: 'mcq',
      marks: 3,
      payload: MCQ_PAYLOAD,
      answer: { selected_option_id: 'a' },
    });
    expect(r).toEqual({ score: 0, maxScore: 3, isCorrect: false });
  });

  it('treats an unanswered MCQ as zero, not as a skip', () => {
    const r = scoreQuestion({ type: 'mcq', marks: 3, payload: MCQ_PAYLOAD, answer: null });
    expect(r.score).toBe(0);
  });
});

describe('Coding scoring', () => {
  it('awards marks proportionally to hidden tests passed', () => {
    const r = scoreQuestion({
      type: 'coding',
      marks: 10,
      payload: {},
      answer: { code: 'x' },
      hiddenPassed: 5,
      hiddenTotal: 10,
    });
    expect(r.score).toBe(5);
    expect(r.isCorrect).toBe(false);
  });

  it('awards full marks only when every hidden test passes', () => {
    const r = scoreQuestion({
      type: 'coding',
      marks: 10,
      payload: {},
      answer: { code: 'x' },
      hiddenPassed: 10,
      hiddenTotal: 10,
    });
    expect(r).toEqual({ score: 10, maxScore: 10, isCorrect: true });
  });

  it('scores zero when the provider ran no hidden tests', () => {
    const r = scoreQuestion({ type: 'coding', marks: 10, payload: {}, answer: { code: 'x' } });
    expect(r.score).toBe(0);
  });
});

describe('SQL scoring', () => {
  // Regression: the candidate UI persists answers as `{ query }`, but the
  // scorer only ever read `result` / `rows` / `query_result`. Nothing matched,
  // so EVERY SQL question scored 0 no matter what the candidate wrote.
  it('grades a query text submission against expected_query', () => {
    const payload = {
      schema_ddl: 'CREATE TABLE users (id INT);',
      expected_query: 'SELECT name FROM users WHERE id = 1;',
    };
    const correct = scoreQuestion({
      type: 'sql',
      marks: 5,
      payload,
      answer: { query: 'SELECT name FROM users WHERE id = 1' },
    });
    expect(correct).toEqual({ score: 5, maxScore: 5, isCorrect: true });
  });

  it('scores zero for a semantically different query', () => {
    const payload = { expected_query: 'SELECT name FROM users WHERE id = 1' };
    const wrong = scoreQuestion({
      type: 'sql',
      marks: 5,
      payload,
      answer: { query: 'SELECT email FROM users WHERE id = 1' },
    });
    expect(wrong).toEqual({ score: 0, maxScore: 5, isCorrect: false });
  });

  it('ignores formatting, comments and trailing semicolons', () => {
    expect(normalizeSqlText('SELECT a  FROM  t; -- pick it')).toBe(normalizeSqlText('select a from t'));
    expect(normalizeSqlText('SELECT * FROM t WHERE x = 1;')).toBe(normalizeSqlText('SELECT * FROM t WHERE x=1'));
  });

  it('still scores an empty submission as zero', () => {
    const r = scoreQuestion({
      type: 'sql',
      marks: 5,
      payload: { expected_query: 'SELECT 1' },
      answer: { query: '   ' },
    });
    expect(r.score).toBe(0);
  });

  it('falls back to result-set comparison when the executor produced rows', () => {
    const r = scoreQuestion({
      type: 'sql',
      marks: 5,
      payload: { expected_result: [['ada', '42'], ['bob', '7']] },
      answer: { rows: [['bob', '7'], ['ada', '42']] },
    });
    // Order-insensitive by default, so the match should succeed.
    expect(r.isCorrect).toBe(true);
  });

  it('enforces row order when the question requires it', () => {
    const payload = { expected_result: [['1'], ['2']], require_order: true };
    const ordered = scoreQuestion({ type: 'sql', marks: 5, payload, answer: { rows: [['1'], ['2']] } });
    const shuffled = scoreQuestion({ type: 'sql', marks: 5, payload, answer: { rows: [['2'], ['1']] } });
    expect(ordered.isCorrect).toBe(true);
    expect(shuffled.isCorrect).toBe(false);
  });

  it('awards nothing when the author supplied no gradable expectation', () => {
    const r = scoreQuestion({
      type: 'sql',
      marks: 5,
      payload: { schema_ddl: 'CREATE TABLE t (a INT);' },
      answer: { query: 'SELECT a FROM t' },
    });
    expect(r.score).toBe(0);
  });

  it('normalizes result sets and parses CSV-ish text', () => {
    expect(normalizeSqlResultSet(['B', 'a'], false)).toBe(normalizeSqlResultSet(['a', 'B'], false));
    expect(parseResultSet('a\nb')).toEqual(['a', 'b']);
    expect(parseResultSet('[[1,2]]')).toEqual([[1, 2]]);
  });
});

describe('Subjective scoring', () => {
  it('returns NULL (never zero) so an ungraded answer is not a silent failure', () => {
    const r = scoreQuestion({ type: 'subjective', marks: 10, payload: { rubric: 'x' }, answer: { text: 'hi' } });
    expect(r.score).toBeNull();
    expect(r.isCorrect).toBeNull();
    expect(r.maxScore).toBe(10);
  });

  it('is excluded from the objective denominator by default', () => {
    const totals = computeTotals({
      scores: [
        { score: 4, maxScore: 5, isCorrect: true },
        { score: null, maxScore: 10, isCorrect: null },
      ],
    });
    expect(totals.maxScore).toBe(5);
    expect(totals.percentage).toBe(80);
  });

  it('is included once a recruiter has graded it', () => {
    const totals = computeTotals({
      scores: [
        { score: 4, maxScore: 5, isCorrect: true },
        { score: 8, maxScore: 10, isCorrect: null },
      ],
    });
    expect(totals.maxScore).toBe(15);
    expect(totals.score).toBe(12);
    expect(totals.percentage).toBe(80);
  });

  it('can include ungraded subjective marks in the maximum when configured', () => {
    const totals = computeTotals({
      scores: [
        { score: 4, maxScore: 5, isCorrect: true },
        { score: null, maxScore: 10, isCorrect: null },
      ],
      includeSubjectiveInMax: true,
    });
    expect(totals.maxScore).toBe(15);
  });
});

describe('Totals and pass rule', () => {
  it('computes a percentage and never divides by zero', () => {
    expect(computeTotals({ scores: [] }).percentage).toBe(0);
  });

  it('applies the percentage pass rule', () => {
    expect(isPassing(59.9, 60)).toBe(false);
    expect(isPassing(60, 60)).toBe(true);
    expect(isPassing(100, 60)).toBe(true);
    expect(isPassing(0, 0)).toBe(true);
  });
});