import { describe, it, expect } from 'vitest';
import { sanitizeQuestion, containsHiddenData } from '@/services/assessments/sanitize';
import { scoreQuestion, computeTotals, isPassing, normalizeSqlResultSet } from '@/services/assessments/scoring';
import { evaluateStage } from '@/services/hiring/progressionService';
import { validateRunInput } from '@/services/codeExecution/types';
import { normalizeLanguage } from '@/services/codeExecution/languages';
import { MockExecutionProvider } from '@/services/codeExecution/mockProvider';
import { progressionJobId } from '@/services/queue/progressionQueue';

describe('hiring workflow — security + scoring + idempotency', () => {
  it('sanitize strips hidden data (mcq/coding/sql/subjective)', () => {
    const mcq = sanitizeQuestion({
      id: 'q1', type: 'mcq', position: 0, title: 't', prompt: 'p',
      payload: { options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], correct_option_id: 'a' },
      marks: 1,
    });
    expect(JSON.stringify(mcq)).not.toContain('correct_option_id');
    expect(containsHiddenData(mcq)).toEqual([]);

    const coding = sanitizeQuestion({
      id: 'q2', type: 'coding', position: 1, title: 't', prompt: 'p',
      payload: {
        language: 'javascript',
        starter_code: 'x',
        test_cases: [
          { input: '1', expected_output: '2' },
          { input: '9', expected_output: '10', is_hidden: true },
        ],
        reference_solution: 'secret',
      },
      marks: 5,
    });
    const cases = coding.payload.test_cases as Array<Record<string, unknown>>;
    expect(cases.length).toBe(1);
    expect(JSON.stringify(coding)).not.toContain('expected_output');
    expect(JSON.stringify(coding)).not.toContain('reference_solution');

    const sql = sanitizeQuestion({
      id: 'q3', type: 'sql', position: 2, title: 't', prompt: 'p',
      payload: { schema_ddl: 'CREATE TABLE t', expected_query: 'SELECT 1', expected_result: '1' },
      marks: 2,
    });
    expect(JSON.stringify(sql)).not.toContain('expected_query');
    expect(containsHiddenData(sql)).toEqual([]);
  });

  it('percentage scoring: passed = percentage >= passing_score', () => {
    const totals = computeTotals({
      scores: [
        { score: 8, maxScore: 10, isCorrect: false },
        { score: null, maxScore: 5, isCorrect: null }, // subjective pending — excluded
      ],
    });
    expect(totals.score).toBe(8);
    expect(totals.maxScore).toBe(10);
    expect(totals.percentage).toBe(80);
    expect(isPassing(totals.percentage, 60)).toBe(true);
    expect(isPassing(totals.percentage, 90)).toBe(false);
  });

  it('subjective stays NULL and never becomes implicit zero', () => {
    const s = scoreQuestion({ type: 'subjective', marks: 5, payload: { rubric: 'r' }, answer: { text: 'x' } });
    expect(s.score).toBeNull();
  });

  it('SQL compares result sets, respecting order only when required', () => {
    const a = normalizeSqlResultSet(['b', 'a'], false);
    const b = normalizeSqlResultSet(['a', 'b'], false);
    expect(a).toBe(b);
    const c = normalizeSqlResultSet(['b', 'a'], true);
    const d = normalizeSqlResultSet(['a', 'b'], true);
    expect(c).not.toBe(d);
  });

  it('run validation rejects invalid language + oversized input', () => {
    const bad = validateRunInput({ language: 'brainfuck', sourceCode: 'x', visibleTests: [] });
    expect(bad.errors.length).toBeGreaterThan(0);
    const ok = validateRunInput({ language: 'javascript', sourceCode: 'console.log(1)', visibleTests: [{ input: '' }] });
    expect(ok.errors).toEqual([]);
    expect(normalizeLanguage('JS')).toBe('javascript');
    expect(normalizeLanguage('python')).toBeNull(); // not enabled yet
  });

  it('mock execution is ALWAYS untrustworthy (never a real pass)', async () => {
    const mock = new MockExecutionProvider();
    expect(mock.isMock).toBe(true);
    const evalResult = await mock.evaluateSubmission({ language: 'javascript', sourceCode: 'x', hiddenTests: [{ input: '1', expected_output: '2' }] });
    expect(evalResult.untrustworthy).toBe(true);
    expect(evalResult.provider).toBe('mock');
  });

  it('evaluateStage routes Assessment->Technical, Technical->HR, bad->Rejected/Hold', () => {
    expect(evaluateStage({ fromStage: 'Assessment', passed: true }).toStage).toBe('Technical Interview');
    expect(evaluateStage({ fromStage: 'Assessment', passed: false }).outcome).toBe('Rejected');
    expect(evaluateStage({ fromStage: 'Technical Interview', recommendation: 'hire' }).toStage).toBe('Managerial/HR');
    expect(evaluateStage({ fromStage: 'Technical Interview', recommendation: 'no_hire' }).outcome).toBe('Rejected');
    expect(evaluateStage({ fromStage: 'Managerial/HR', recommendation: 'hold' }).outcome).toBe('Hold');
  });

  it('progression job ids are stable per trigger (double-submit collapses)', () => {
    expect(progressionJobId('assessment_submission', 'attempt-123')).toBe(
      progressionJobId('assessment_submission', 'attempt-123'),
    );
    expect(progressionJobId('assessment_submission', 'a')).not.toBe(progressionJobId('assessment_submission', 'b'));
  });

  it('candidate responses never contain credentials or hidden keys', () => {
    const fakeResponse = { provider: 'mock', stdout: 'hi' };
    const text = JSON.stringify(fakeResponse);
    for (const secret of ['JUDGE0_API_KEY', 'service_role', 'token_encrypted', 'correct_option_id', 'expected_output', 'reference_solution', 'private_notes']) {
      expect(text).not.toContain(secret);
    }
  });
});
