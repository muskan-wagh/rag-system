import { API_BASE } from "./constants"
import { apiFetch } from "./api-fetch"

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  details?: unknown
}

export interface ParsedJD {
  title: string
  skills: string[]
  experience: { min: number; max: number }
  education: { level: string; field: string }
  responsibilities: string[]
  requirements: string[]
  rawText: string
}

export interface Candidate {
  id: string
  name: string
  email?: string
  phone?: string
  skills: string[]
  experience: number
  education: {
    level: string
    field: string
    details?: string
  }
  summary: string
}

interface RankingScore {
  skill: number
  experience: number
  education: number
  overall: number
}

export interface RankingResult {
  candidate: Candidate
  scores: RankingScore
  explanation: string
}

export interface SearchFilters {
  minExperience?: number
  maxExperience?: number
  skills?: string[]
  educationLevel?: string
}

export interface UploadSession {
  sessionId: string
  link: string
  createdAt: string
}

export interface ScreeningQuestion {
  question: string
  focus_area: string
  why_this_matters: string
}

export interface ClosingStrategy {
  selling_points: Array<{ point: string; detail: string }>
  major_objection: { objection: string; overcome_strategy: string }
}

async function request<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${endpoint}`
  const res = await apiFetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  })
  return res.json() as Promise<ApiResponse<T>>
}

export async function searchCandidates(
  jdText: string,
  limit = 10,
  filters?: SearchFilters,
) {
  return request<{ results: RankingResult[]; query: ParsedJD }>(
    "/candidates/search",
    {
      method: "POST",
      body: JSON.stringify({ jdText, limit, filters }),
    },
  )
}

export async function compareCandidates(
  jdText: string,
  candidateIds: string[],
) {
  return request<{ comparison: string; query: ParsedJD }>(
    "/candidates/compare",
    {
      method: "POST",
      body: JSON.stringify({ jdText, candidateIds }),
    },
  )
}

export async function getCandidate(id: string) {
  return request<Candidate>(`/candidates/${id}`, { method: "GET" })
}

export async function batchCandidates(ids: string[]) {
  return request<Candidate[]>("/candidates/batch", {
    method: "POST",
    body: JSON.stringify({ ids }),
  })
}

export async function generateLink(jdText: string) {
  return request<UploadSession>("/generate-link", {
    method: "POST",
    body: JSON.stringify({ jdText }),
  })
}

export async function getSession(sessionId: string) {
  return request<{
    session: UploadSession
    candidates: Candidate[]
    candidateCount: number
  }>(`/sessions/${sessionId}`, { method: "GET" })
}

export async function getScreeningQuestions(candidateId: string) {
  return request<{ questions: ScreeningQuestion[] }>(
    `/candidates/${candidateId}/screening-questions`,
    { method: "POST" },
  )
}

export async function getClosingStrategy(candidateId: string) {
  return request<ClosingStrategy>(
    `/candidates/${candidateId}/closing-strategy`,
    { method: "POST" },
  )
}


