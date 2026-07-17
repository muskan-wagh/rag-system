import { API_BASE } from "./constants"
import { apiFetch } from "./api-fetch"
import type {
  ApiResponse,
  ParsedJD,
  Candidate,
  RankingResult,
  SearchFilters,
  BiasResult,
  SessionSummary,
  SessionStats,
  CandidateRecord,
  PaginatedCandidates,
  InterviewData,
  OfferData,
  TimelineEntry,
  DashboardData,
  CandidatesPageData,
} from "./types"

export type {
  ParsedJD,
  Candidate,
  RankingResult,
  RankingScore,
  SearchFilters,
  BiasResult,
  SessionSummary,
  SessionStats,
  CandidateRecord,
  PaginatedCandidates,
  InterviewData,
  OfferData,
  TimelineEntry,
  DashboardData,
  CandidatesPageData,
} from "./types"

export type { StatusFilter } from "./types"

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

export async function getSessions() {
  return request<SessionSummary[]>("/sessions", { method: "GET" })
}

export async function getSessionStats(sessionId: string) {
  return request<SessionStats>(`/sessions/${sessionId}/stats`, { method: "GET" })
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

export async function getCandidateTimeline(candidateId: string) {
  return request<TimelineEntry[]>(
    `/candidates/${candidateId}/timeline`,
    { method: "GET" },
  )
}

export async function getDashboard(page = 1, limit = 50) {
  return request<DashboardData>(`/dashboard?page=${page}&limit=${limit}`, { method: "GET" })
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

export async function markCandidateAsHired(candidateId: string) {
  return updateCandidateStatus(candidateId, "Hired")
}
