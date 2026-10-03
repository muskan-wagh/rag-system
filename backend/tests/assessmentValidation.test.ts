import { describe, it, expect } from 'vitest';
import {
  validateQuestion,
  validatePublish,
  validateReorder,
  normalizeMcqOptions,
  questionTotals,
} from '@/services/assessments/validation';
import {
  generateInviteToken,
  hashInviteToken,
  encryptInviteToken,
  decryptInviteToken,
  buildAssessmentLink,
  isWindowExpired,
  inviteEmailKey,
} from '@/services/assessments/inviteCrypto';
import {
  buildAssessmentInviteEmail,
  assessmentInviteSubject,
} from '@/services/email/assessmentInvite';

const mcqPayload = {
  options: [
    { id: 'a', text: 'Option A' },
    { id: 'b', text: 'Option B' },
  ],
  correct_option_id: 'a',
};

describe('validateQuestion', () => {
  it('accepts a valid MCQ', () => {
    expect(validateQuestion({ type: 'mcq', prompt: '2+2?', payload: mcqPayload, marks: 2 })).toEqual([]);
  });

  it('rejects MCQ with fewer than 2 options', () => {
    const errors = validateQuestion({
      type: 'mcq',
      prompt: 'Pick one',
      payload: { options: [{ id: 'a', text: 'Only' }], correct_option_id: 'a' },
      marks: 1,
    });
    expect(errors.join(' ')).toMatch(/at least 2 options/);
  });

  it('rejects MCQ with unknown correct option', () => {
    const errors = validateQuestion({
      type: 'mcq',
      prompt: 'Pick one',
      payload: { ...mcqPayload, correct_option_id: 'zzz' },
      marks: 1,
    });
    expect(errors.join(' ')).toMatch(/must match one of the options/);
  });

  it('requires prompt and marks on every type', () => {
    const errors = validateQuestion({ type: 'subjective', prompt: '  ', payload: { rubric: 'r' }, marks: 1 });
    expect(errors.join(' ')).toMatch(/prompt is required/i);
    const neg = validateQuestion({ type: 'subjective', prompt: 'Q?', payload: { rubric: 'r' }, marks: -1 });
    expect(neg.join(' ')).toMatch(/marks must be a number >= 0/i);
  });

  it('accepts valid coding / sql / subjective payloads', () => {
    expect(
      validateQuestion({
        type: 'coding',
        prompt: 'Reverse a string',
        payload: { language: 'python', starter_code: 'def rev(s):', test_cases: [{ input: 'ab', expected_output: 'ba' }] },
        marks: 5,
      }),
    ).toEqual([]);
    expect(
      validateQuestion({
        type: 'sql',
        prompt: 'Top earners',
        payload: { schema_ddl: 'CREATE TABLE emp(id INT);', expected_query: 'SELECT * FROM emp;' },
        marks: 3,
      }),
    ).toEqual([]);
    expect(
      validateQuestion({ type: 'subjective', prompt: 'Describe CAP theorem', payload: { rubric: 'Mentions C/A/P' }, marks: 4 }),
    ).toEqual([]);
  });

  it('rejects coding without language/starter/test-cases', () => {
    const errors = validateQuestion({ type: 'coding', prompt: 'Q', payload: {}, marks: 1 });
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });

  it('rejects sql without schema and without expected solution', () => {
    const errors = validateQuestion({ type: 'sql', prompt: 'Q', payload: {}, marks: 1 });
    expect(errors.join(' ')).toMatch(/schema definition/);
  });

  it('rejects subjective without rubric and unknown types', () => {
    expect(validateQuestion({ type: 'subjective', prompt: 'Q', payload: {}, marks: 1 }).join(' ')).toMatch(/rubric/);
    expect(validateQuestion({ type: 'essay', prompt: 'Q', payload: {}, marks: 1 }).join(' ')).toMatch(/invalid question type/i);
  });

  it('normalizes string options with stable ids', () => {
    expect(normalizeMcqOptions(['Yes', 'No'])).toEqual([
      { id: 'opt-1', text: 'Yes' },
      { id: 'opt-2', text: 'No' },
    ]);
  });

  it('computes totals', () => {
    expect(questionTotals([{ marks: 2 }, { marks: 3 }])).toEqual({ totalQuestions: 2, totalMarks: 5 });
  });
});

describe('validatePublish', () => {
  const question = (overrides = {}) => ({
    id: 'q1',
    type: 'mcq',
    prompt: '2+2?',
    payload: mcqPayload,
    marks: 2,
    ...overrides,
  });

  it('passes a well-formed draft', () => {
    expect(
      validatePublish({ name: 'Backend screen', passing_score: 1, questions: [question()] }),
    ).toEqual([]);
  });

  it('requires name and at least one question', () => {
    expect(validatePublish({ name: '  ', passing_score: 0, questions: [question()] }).join(' ')).toMatch(/name is required/);
    expect(validatePublish({ name: 'A', passing_score: 0, questions: [] }).join(' ')).toMatch(/at least 1 question/);
  });

  it('requires total marks > 0 and passing within range', () => {
    const zero = validatePublish({ name: 'A', passing_score: 0, questions: [question({ id: 'z', marks: 0 })] });
    expect(zero.join(' ')).toMatch(/greater than 0/);
    const over = validatePublish({ name: 'A', passing_score: 99, questions: [question()] });
    expect(over.join(' ')).toMatch(/cannot exceed total marks/);
  });

  it('rejects bad windows and bad question payloads', () => {
    const window = validatePublish({
      name: 'A',
      passing_score: 0,
      available_from: '2026-10-02T00:00:00Z',
      available_until: '2026-10-01T00:00:00Z',
      questions: [question()],
    });
    expect(window.join(' ')).toMatch(/earlier than available_until/);
    const badQ = validatePublish({
      name: 'A',
      passing_score: 0,
      questions: [question({ payload: { options: [], correct_option_id: 'x' } })],
    });
    expect(badQ.length).toBeGreaterThan(0);
  });

  it('rejects duplicate question ids', () => {
    const dup = validatePublish({ name: 'A', passing_score: 0, questions: [question(), question()] });
    expect(dup.join(' ')).toMatch(/duplicate/i);
  });
});

describe('validateReorder', () => {
  it('accepts an exact permutation and rejects the rest', () => {
    expect(validateReorder(['a', 'b'], ['b', 'a'])).toEqual([]);
    expect(validateReorder(['a', 'b'], ['a', 'a']).join(' ')).toMatch(/duplicate/);
    expect(validateReorder(['a', 'b'], ['a']).join(' ')).toMatch(/exactly the current/);
    expect(validateReorder(['a', 'b'], ['a', 'zzz']).join(' ')).toMatch(/exactly the current/);
  });
});

describe('inviteCrypto', () => {
  it('generates opaque tokens with sha256 hashes', () => {
    const token = generateInviteToken();
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(hashInviteToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('round-trips encryption for same-token resends', () => {
    const token = generateInviteToken();
    expect(decryptInviteToken(encryptInviteToken(token))).toBe(token);
  });

  it('builds links and detects expired windows', () => {
    const link = buildAssessmentLink('tok123');
    expect(link).toContain('/assessments/take/tok123');
    expect(isWindowExpired(undefined)).toBe(false);
    expect(isWindowExpired(new Date(Date.now() + 3600_000).toISOString())).toBe(false);
    expect(isWindowExpired(new Date(Date.now() - 1000).toISOString())).toBe(true);
  });

  it('uses event-keyed email keys (resends differ, first send is stable)', () => {
    const first = inviteEmailKey('a', 'c', 1);
    expect(inviteEmailKey('a', 'c', 1)).toBe(first);
    expect(inviteEmailKey('a', 'c', 2)).not.toBe(first);
  });
});

describe('assessmentInviteEmail', () => {
  it('contains name, duration, window, instructions and link', () => {
    const html = buildAssessmentInviteEmail({
      candidateName: 'Ada',
      assessmentName: 'Backend Screen',
      durationMinutes: 60,
      availableFrom: '2026-10-02T10:00:00Z',
      availableUntil: '2026-10-09T10:00:00Z',
      instructions: 'No phones.',
      assessmentLink: 'http://localhost:3000/assessments/take/abc',
    });
    expect(assessmentInviteSubject('Backend Screen')).toContain('Backend Screen');
    for (const needle of ['Ada', 'Backend Screen', '60 minutes', 'No phones.', 'assessments/take/abc', 'Start Assessment']) {
      expect(html).toContain(needle);
    }
  });
});
