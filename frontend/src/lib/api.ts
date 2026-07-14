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

export interface BiasResult {
  has_bias: boolean
  issues: Array<{ category: string; text: string; suggestion: string }>
  suggestions: string[]
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
  limit = 20,
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

export async function updateCandidateStatus(candidateId: string, status: string) {
  return request<{ message: string }>(
    `/candidates/${candidateId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  )
}

export async function addCandidateNote(candidateId: string, noteText: string) {
  return request<{ message: string }>(
    `/candidates/${candidateId}/notes`,
    {
      method: "POST",
      body: JSON.stringify({ noteText }),
    },
  )
}

export async function getCandidateNotes(candidateId: string) {
  return request<Array<{ id: string; note_text: string; created_at: string }>>(
    `/candidates/${candidateId}/notes`,
    { method: "GET" },
  )
}

export async function getScreeningQuestions(candidateId: string) {
  return request<{ questions: Array<{ question: string; focus_area: string; why_this_matters: string }> }>(
    `/candidates/${candidateId}/screening-questions`,
    { method: "POST" },
  )
}

export async function getClosingStrategy(candidateId: string) {
  return request<{ selling_points: Array<{ point: string; detail: string }>; major_objection: { objection: string; overcome_strategy: string } }>(
    `/candidates/${candidateId}/closing-strategy`,
    { method: "POST" },
  )
}

export async function scanBias(jdText: string) {
  return request<BiasResult>("/scan-bias", {
    method: "POST",
    body: JSON.stringify({ jdText }),
  })
}

// --- New API functions for dashboard & candidate management ---

export interface SessionSummary {
  id: string
  job_description_text: string
  created_at: string
  candidate_count: number
}

export async function getSessions() {
  return request<SessionSummary[]>("/sessions", { method: "GET" })
}

export interface SessionStats {
  open: number
  applied: number
  screening: number
  interview: number
  interviewsToday: number
  offered: number
  hired: number
  rejected: number
}

export async function getSessionStats(sessionId: string) {
  return request<SessionStats>(`/sessions/${sessionId}/stats`, { method: "GET" })
}

export interface CandidateRecord {
  id: string
  upload_session_id?: string
  full_name?: string
  email?: string
  phone?: string
  location?: string
  current_company?: string
  current_title?: string
  total_experience_years?: number
  raw_resume_text?: string
  resume_file_url?: string
  flight_risk?: string
  growth_trajectory?: string
  current_status?: string
  created_at?: string
  skills?: string[]
  match_score?: number
}

export interface PaginatedCandidates {
  candidates: CandidateRecord[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export async function getAllCandidates(params: {
  page?: number
  limit?: number
  search?: string
  sortBy?: string
  sortOrder?: "asc" | "desc"
  sessionId?: string
  status?: string
} = {}) {
  const searchParams = new URLSearchParams()
  if (params.page) searchParams.set("page", String(params.page))
  if (params.limit) searchParams.set("limit", String(params.limit))
  if (params.search) searchParams.set("search", params.search)
  if (params.sortBy) searchParams.set("sortBy", params.sortBy)
  if (params.sortOrder) searchParams.set("sortOrder", params.sortOrder)
  if (params.sessionId) searchParams.set("sessionId", params.sessionId)
  if (params.status) searchParams.set("status", params.status)
  const qs = searchParams.toString()
  return request<PaginatedCandidates>(`/candidates${qs ? `?${qs}` : ""}`, { method: "GET" })
}

export async function getCandidateRecord(id: string) {
  return request<CandidateRecord>(`/candidates/${id}`, { method: "GET" })
}

// --- New Candidate Workflow API functions ---

export interface InterviewData {
  id: string
  candidate_id: string
  scheduled_date: string
  scheduled_time: string
  interview_type: string
  interviewer_name: string
  notes: string
  meeting_link: string
  status: string
  created_at: string
}

export interface OfferData {
  id: string
  candidate_id: string
  salary: number | null
  joining_date: string | null
  notes: string
  status: string
  created_at: string
}

export interface TimelineEntry {
  id: string
  candidate_id: string
  status: string
  changed_at: string
  changed_by: string
  details: Record<string, unknown> | null
}

export async function scheduleInterview(
  candidateId: string,
  data: {
    scheduledDate: string
    scheduledTime: string
    interviewType: string
    interviewerName?: string
    notes?: string
  },
) {
  return request<InterviewData>(
    `/candidates/${candidateId}/interviews`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  )
}

export async function getCandidateInterviews(candidateId: string) {
  return request<InterviewData[]>(
    `/candidates/${candidateId}/interviews`,
    { method: "GET" },
  )
}

export async function rescheduleInterview(
  candidateId: string,
  interviewId: string,
  data: {
    scheduledDate?: string
    scheduledTime?: string
    interviewType?: string
    interviewerName?: string
    notes?: string
    status?: string
  },
) {
  return request<{ message: string }>(
    `/candidates/${candidateId}/interviews/${interviewId}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    },
  )
}

export async function makeOffer(
  candidateId: string,
  data: { salary?: number; joiningDate?: string; notes?: string },
) {
  return request<OfferData>(
    `/candidates/${candidateId}/offer`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  )
}

export async function acceptOffer(candidateId: string) {
  return request<{ message: string }>(
    `/candidates/${candidateId}/hire`,
    { method: "POST" },
  )
}

export async function rejectCandidate(
  candidateId: string,
  reason: string,
  notes?: string,
  changedBy?: string,
) {
  return request<{ message: string }>(
    `/candidates/${candidateId}/reject`,
    {
      method: "POST",
      body: JSON.stringify({ reason, notes, changedBy }),
    },
  )
}

export async function generateEmailTemplate(candidateId: string) {
  return request<{ subject: string; body: string }>(
    `/candidates/${candidateId}/email-template`,
    { method: "POST" },
  )
}

export async function sendInterviewEmail(candidateId: string, interviewId?: string, subject?: string, body?: string) {
  return request<{ message: string; subject?: string; body?: string }>(
    `/candidates/${candidateId}/send-email`,
    {
      method: "POST",
      body: JSON.stringify({ interviewId, subject, body }),
    },
  )
}

export async function markCandidateAsHired(candidateId: string) {
  return updateCandidateStatus(candidateId, "Hired")
}

export async function getCandidateTimeline(candidateId: string) {
  return request<TimelineEntry[]>(
    `/candidates/${candidateId}/timeline`,
    { method: "GET" },
  )
}

export type StatusFilter = 'open' | 'screening' | 'offered' | 'hired' | 'rejected' | 'all'

// --- Combined single-response endpoints (eliminate waterfall) ---

export interface DashboardData {
  session: {
    id: string
    job_description_text: string
    created_at: string
    link: string
  } | null
  candidates: CandidateRecord[]
  stats: SessionStats
  pagination?: {
    page: number
    limit: number
  }
}

export async function getDashboard(page = 1, limit = 50) {
  return request<DashboardData>(`/dashboard?page=${page}&limit=${limit}`, { method: "GET" })
}

export interface CandidatesPageData {
  sessions: SessionSummary[]
  candidates: CandidateRecord[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export async function getCandidatesPage(params: {
  page?: number
  limit?: number
  search?: string
  sortBy?: string
  sortOrder?: "asc" | "desc"
  sessionId?: string
  status?: string
} = {}) {
  const searchParams = new URLSearchParams()
  if (params.page) searchParams.set("page", String(params.page))
  if (params.limit) searchParams.set("limit", String(params.limit))
  if (params.search) searchParams.set("search", params.search)
  if (params.sortBy) searchParams.set("sortBy", params.sortBy)
  if (params.sortOrder) searchParams.set("sortOrder", params.sortOrder)
  if (params.sessionId) searchParams.set("sessionId", params.sessionId)
  if (params.status) searchParams.set("status", params.status)
  const qs = searchParams.toString()
  return request<CandidatesPageData>(`/candidates-page${qs ? `?${qs}` : ""}`, { method: "GET" })
}
