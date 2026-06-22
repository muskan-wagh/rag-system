import { API_BASE } from "./constants"

export interface ApiResponse<T> {
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

export interface RankingScore {
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

async function request<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${endpoint}`
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  })
  return res.json() as Promise<ApiResponse<T>>
}

export async function parseJD(jdText: string) {
  return request<{ parsed: ParsedJD }>("/jd/parse", {
    method: "POST",
    body: JSON.stringify({ jdText }),
  })
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

export interface SkillCount {
  skill: string
  count: number
  percentage: number
}

export interface ExperienceBucket {
  range: string
  count: number
}

export interface EducationBucket {
  level: string
  count: number
}

export interface AnalyticsData {
  totalCandidates: number
  avgExperience: number
  skills: SkillCount[]
  topSkills: SkillCount[]
  experienceDistribution: ExperienceBucket[]
  educationDistribution: EducationBucket[]
}

export async function getAnalytics() {
  return request<AnalyticsData>("/analytics", { method: "GET" })
}

export async function sendChatMessage(
  message: string,
  context?: { jdText?: string; candidateIds?: string[] },
) {
  return request<{ reply: string }>("/chat", {
    method: "POST",
    body: JSON.stringify({ message, context }),
  })
}
