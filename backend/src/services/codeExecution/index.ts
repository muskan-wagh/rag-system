import { MockExecutionProvider } from './mockProvider';
import { Judge0Provider, isJudge0Configured } from './judge0Provider';
import type {
  CodeExecutionProvider,
  HiddenTestCase,
  VisibleRunResult,
  VisibleTestCase,
} from './types';

/**
 * CodeExecutionService facade.
 * getProvider() prefers Judge0 when configured, else mock.
 * Callers MUST branch on result.isMock / untrustworthy for scoring.
 */
export function getExecutionProvider(): CodeExecutionProvider {
  if (isJudge0Configured()) return new Judge0Provider();
  return new MockExecutionProvider();
}

export function executionMode(): { provider: string; isMock: boolean; judge0Configured: boolean } {
  const configured = isJudge0Configured();
  return { provider: configured ? 'judge0' : 'mock', isMock: !configured, judge0Configured: configured };
}

/** Run Code — visible tests only. Never scores, never hidden tests. */
export async function runVisibleCode(input: {
  language: string;
  sourceCode: string;
  stdin?: string;
  visibleTests: VisibleTestCase[];
}): Promise<VisibleRunResult> {
  return getExecutionProvider().runVisible(input);
}

/**
 * Final submission — hidden tests server-side. Returns pass counts.
 * When provider is mock, untrustworthy=true and the submit handler
 * must refuse to produce a real pass (correction #6).
 */
export async function evaluateCodeSubmission(input: {
  language: string;
  sourceCode: string;
  hiddenTests: HiddenTestCase[];
  timeLimitMs?: number;
}): Promise<{ hiddenPassed: number; hiddenTotal: number; provider: string; isMock: boolean; untrustworthy: boolean }> {
  return getExecutionProvider().evaluateSubmission(input);
}
