import { API_BASE } from "./constants"
import { apiFetch } from "./api-fetch"

/**
 * Candidate API — session-cookie based (HttpOnly hs_candidate cookie).
 * Raw invite tokens are exchanged ONCE via the exchange endpoint and
 * never stored in localStorage. All subsequent calls rely on the
 * cookie (credentials: include).
 */

async function candidateRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await apiFetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...((options?.headers as Record<string, string>) || {}) },
  })
  const body = (await res.json()) as { success: boolean; data?: T; error?: string };
  if (!body.success) throw new Error(body.error || "Request failed");
  return body.data as T;
}

export interface SafeQuestion {
  id: string;
  type: string;
  position: number;
  title: string;
  prompt: string;
  payload: Record<string, unknown>;
  marks: number;
  skill_tag?: string;
  is_required?: boolean;
}

export interface CandidateAssessment {
  assessment: {
    id: string;
    name: string;
    description: string;
    instructions: string;
    duration_minutes: number;
    settings: Record<string, unknown>;
  };
  questions: SafeQuestion[];
  attempt: { id: string; status: string; started_at: string; expires_at: string | null; attempt_number: number } | null;
  answers: Array<{ question_id: string; answer: Record<string, unknown>; language: string | null; updated_at: string }>;
}

export interface RunCodeResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  executionTimeMs: number | null;
  timedOut: boolean;
  testResults: Array<{ input: string; passed: boolean | null; actual: string }>;
  provider: string;
  isMock: boolean;
}

export interface SubmitResult {
  id: string;
  status: string;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  deduplicated?: boolean;
}

export const candidateApi = {
  exchangeAssessmentToken: (token: string) =>
    candidateRequest<{ attemptId: string; assessmentId: string; expiresAt: string | null }>(
      "/candidate/assessment/exchange",
      { method: "POST", body: JSON.stringify({ token }) },
    ),
  getAssessment: () => candidateRequest<CandidateAssessment>("/candidate/assessment", { method: "GET" }),
  saveAnswer: (attemptId: string, data: { questionId: string; answer?: unknown; language?: string; code?: string }) =>
    candidateRequest<{ saved: boolean }>(`/candidate/attempts/${attemptId}/answers`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  runCode: (attemptId: string, data: { questionId: string; language: string; sourceCode: string; stdin?: string }) =>
    candidateRequest<RunCodeResult>(`/candidate/attempts/${attemptId}/code/run`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  submit: (attemptId: string) =>
    candidateRequest<SubmitResult>(`/candidate/attempts/${attemptId}/submit`, { method: "POST" }),
  getProgress: () =>
    candidateRequest<{ stages: Array<{ stage: string; state: string; score: number | null }>; currentStage: string | null }>(
      "/candidate/progress",
      { method: "GET" },
    ),
  logProctoring: (attemptId: string, eventType: string, metadata?: Record<string, unknown>) =>
    candidateRequest<{ logged: boolean }>(`/candidate/attempts/${attemptId}/proctoring`, {
      method: "POST",
      body: JSON.stringify({ eventType, metadata: metadata || {} }),
    }),
  exchangeInterviewToken: (token: string) =>
    candidateRequest<{
      stage: string;
      status: string;
      scheduled_date: string;
      scheduled_time: string;
      interview_type: string;
      meeting_link: string;
    }>("/candidate/interview/exchange", { method: "POST", body: JSON.stringify({ token }) }),
  getInterview: () =>
    candidateRequest<Record<string, unknown>>("/candidate/interview", { method: "GET" }),
};
