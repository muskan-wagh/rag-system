import { judge0LanguageId } from './languages';
import type { CodeExecutionProvider, HiddenTestCase, VisibleRunResult } from './types';
import { RUN_LIMITS } from './types';

/**
 * Judge0 provider (optional — only active when JUDGE0_BASE_URL is set;
 * JUDGE0_API_KEY sent server-side only, never to the browser).
 * Uses Judge0 CE synchronous submissions with base64 encoding.
 */

interface Judge0Config {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
}

function getConfig(): Judge0Config | null {
  const baseUrl = (process.env.JUDGE0_BASE_URL || '').trim().replace(/\/+$/, '');
  if (!baseUrl) return null;
  return {
    baseUrl,
    apiKey: (process.env.JUDGE0_API_KEY || '').trim(),
    timeoutMs: Number(process.env.JUDGE0_TIMEOUT_MS || RUN_LIMITS.timeoutMs),
  };
}

export function isJudge0Configured(): boolean {
  return getConfig() !== null;
}

function b64(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64');
}

function unb64(s: string | null | undefined): string {
  if (!s) return '';
  try {
    return Buffer.from(s, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

async function submitOnce(cfg: Judge0Config, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cfg.apiKey) headers['X-Auth-Token'] = cfg.apiKey;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const res = await fetch(`${cfg.baseUrl}/submissions?base64_encoded=true&wait=true`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Judge0 error: HTTP ${res.status}`);
    return (await res.json()) as Record<string, unknown>;
  } finally {
    clearTimeout(timer);
  }
}

export class Judge0Provider implements CodeExecutionProvider {
  name = 'judge0';
  isMock = false;

  private async runOne(language: string, sourceCode: string, stdin: string): Promise<{ stdout: string; stderr: string; statusId: number; timeMs: number | null }> {
    const cfg = getConfig();
    if (!cfg) throw new Error('Judge0 not configured');
    const languageId = judge0LanguageId(language);
    if (!languageId) throw new Error(`Unsupported language: ${language}`);
    const out = await submitOnce(cfg, {
      language_id: languageId,
      source_code: b64(sourceCode),
      stdin: b64(stdin),
    });
    const statusId = Number((out.status as { id?: number } | undefined)?.id || 0);
    return {
      stdout: unb64(out.stdout as string).slice(0, 32_768),
      stderr: unb64(out.stderr as string).slice(0, 32_768) || (out.compile_output ? unb64(out.compile_output as string).slice(0, 32_768) : ''),
      statusId,
      timeMs: out.time ? Math.round(Number(out.time) * 1000) : null,
    };
  }

  async runVisible(input: { language: string; sourceCode: string; stdin?: string; visibleTests: Array<{ input: string }> }): Promise<VisibleRunResult> {
    const started = Date.now();
    // Baseline run with provided stdin.
    const base = await this.runOne(input.language, input.sourceCode, input.stdin || '');
    const testResults: VisibleRunResult['testResults'] = [];
    // Visible tests: re-run per input (bounded by validation layer).
    for (const t of input.visibleTests.slice(0, 10)) {
      try {
        const r = await this.runOne(input.language, input.sourceCode, t.input);
        testResults.push({ input: t.input, passed: null, actual: (r.stdout || r.stderr).slice(0, 2000) });
      } catch {
        testResults.push({ input: t.input, passed: null, actual: '[execution failed]' });
      }
    }
    return {
      stdout: base.stdout,
      stderr: base.stderr,
      exitCode: base.statusId === 3 ? 0 : base.statusId,
      executionTimeMs: Date.now() - started,
      timedOut: false,
      testResults,
      provider: 'judge0',
      isMock: false,
    };
  }

  async evaluateSubmission(input: { language: string; sourceCode: string; hiddenTests: HiddenTestCase[]; timeLimitMs?: number }) {
    let passed = 0;
    for (const t of input.hiddenTests) {
      try {
        const r = await this.runOne(input.language, input.sourceCode, t.input);
        if (r.stdout.trim() === t.expected_output.trim()) passed += 1;
      } catch {
        // Provider failure on one case = that case failed; overall
        // provider outage is surfaced by the caller via throw.
      }
    }
    return {
      hiddenPassed: passed,
      hiddenTotal: input.hiddenTests.length,
      provider: 'judge0',
      isMock: false,
      untrustworthy: false,
    };
  }
}
