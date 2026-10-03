/**
 * CodeExecutionService — provider abstraction (correction #5, #6).
 *
 * Two strictly separated entry points:
 *   runVisibleCode()       — Run button: visible/sample tests ONLY.
 *                            Returns stdout/stderr + visible results.
 *                            NEVER scores, NEVER touches hidden tests.
 *   evaluateCodeSubmission() — Final submit: hidden tests server-side.
 *                            Returns pass counts for scoring. NEVER
 *                            exposes hidden inputs/expected outputs.
 *
 * Mock guard (correction #6): when Judge0 is unconfigured, the mock
 * provider is clearly marked (provider: 'mock', isMock: true) and
 * scored submission MUST NOT treat mock output as a real pass —
 * enforced in the submit path (blocks or marks unavailable in prod).
 */

import { normalizeLanguage } from './languages';

export interface VisibleTestCase {
  input: string;
  isSample?: boolean;
}

export interface HiddenTestCase {
  input: string;
  expected_output: string;
}

export interface VisibleRunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  executionTimeMs: number | null;
  timedOut: boolean;
  testResults: Array<{ input: string; passed: boolean | null; actual: string }>;
  provider: string;
  isMock: boolean;
}

export interface SubmissionEvalResult {
  hiddenPassed: number;
  hiddenTotal: number;
  provider: string;
  isMock: boolean;
  /** True when the result must not be trusted for real scoring. */
  untrustworthy: boolean;
}

export interface CodeExecutionProvider {
  name: string;
  isMock: boolean;
  runVisible(input: {
    language: string;
    sourceCode: string;
    stdin?: string;
    visibleTests: VisibleTestCase[];
  }): Promise<VisibleRunResult>;
  evaluateSubmission(input: {
    language: string;
    sourceCode: string;
    hiddenTests: HiddenTestCase[];
    timeLimitMs?: number;
  }): Promise<SubmissionEvalResult>;
}

export const RUN_LIMITS = {
  maxSourceBytes: 64 * 1024,
  maxStdinBytes: 16 * 1024,
  maxVisibleTests: 10,
  timeoutMs: 10_000,
} as const;

export function validateRunInput(input: {
  language: unknown;
  sourceCode: unknown;
  stdin?: unknown;
  visibleTests?: unknown;
}): { language: string; sourceCode: string; stdin: string; visibleTests: VisibleTestCase[]; errors: string[] } {
  const errors: string[] = [];
  const language = normalizeLanguage(input.language);
  if (!language) errors.push('Invalid language. Allowed: javascript.');

  const sourceCode = typeof input.sourceCode === 'string' ? input.sourceCode : '';
  if (!sourceCode.trim()) errors.push('sourceCode is required.');
  if (Buffer.byteLength(sourceCode, 'utf8') > RUN_LIMITS.maxSourceBytes) {
    errors.push(`sourceCode exceeds ${RUN_LIMITS.maxSourceBytes} bytes.`);
  }

  const stdin = typeof input.stdin === 'string' ? input.stdin : '';
  if (Buffer.byteLength(stdin, 'utf8') > RUN_LIMITS.maxStdinBytes) {
    errors.push(`stdin exceeds ${RUN_LIMITS.maxStdinBytes} bytes.`);
  }

  let visibleTests: VisibleTestCase[] = [];
  if (input.visibleTests !== undefined) {
    if (!Array.isArray(input.visibleTests)) {
      errors.push('visibleTests must be an array.');
    } else {
      if (input.visibleTests.length > RUN_LIMITS.maxVisibleTests) {
        errors.push(`visibleTests exceeds ${RUN_LIMITS.maxVisibleTests} cases.`);
      } else {
        visibleTests = (input.visibleTests as Array<Record<string, unknown>>).map((t) => ({
          input: typeof t.input === 'string' ? t.input : '',
          isSample: t.isSample === true,
        }));
      }
    }
  }

  return { language: language || '', sourceCode, stdin, visibleTests, errors };
}
