import type { CodeExecutionProvider, HiddenTestCase } from './types';

/**
 * Mock provider — development/test ONLY (correction #6).
 * Clearly marked isMock: true. evaluateSubmission ALWAYS returns
 * untrustworthy: true so the submit path can never advance a real
 * candidate on fake output. Production submit with mock configured
 * is blocked (see candidateAssessment submit handler).
 */
export class MockExecutionProvider implements CodeExecutionProvider {
  name = 'mock';
  isMock = true;

  async runVisible(input: { language: string; sourceCode: string; stdin?: string; visibleTests: Array<{ input: string }> }) {
    const preview = input.sourceCode.slice(0, 200);
    return {
      stdout: `[mock execution — Judge0 not configured]\nLanguage: ${input.language}\nCode preview (${input.sourceCode.length} chars):\n${preview}`,
      stderr: '',
      exitCode: 0,
      executionTimeMs: 1,
      timedOut: false,
      testResults: (input.visibleTests || []).map((t) => ({
        input: t.input,
        passed: null as boolean | null,
        actual: '[mock — not executed]',
      })),
      provider: 'mock',
      isMock: true,
    };
  }

  async evaluateSubmission(_input: { language: string; sourceCode: string; hiddenTests: HiddenTestCase[] }) {
    return {
      hiddenPassed: 0,
      hiddenTotal: (_input.hiddenTests || []).length,
      provider: 'mock',
      isMock: true,
      untrustworthy: true,
    };
  }
}
