import { API_BASE, CANDIDATE_STATUS } from "./constants"
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
  authorization?: string,
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${endpoint}`
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (authorization) {
    headers["Authorization"] = authorization
  }
  const res = await apiFetch(url, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string> || {}) },
  })
  return res.json() as Promise<ApiResponse<T>>
}

export function createApiClient(getToken: () => Promise<string | null>) {
  async function withAuth<T>(fn: (auth: string) => Promise<T>): Promise<T> {
    const token = await getToken()
    const authorization = token ? `Bearer ${token}` : ""
    return fn(authorization)
  }

  return {
    searchCandidates: (jdText: string, limit = 20, filters?: SearchFilters) =>
      withAuth((a) =>
        request<{ results: RankingResult[]; query: ParsedJD }>(
          "/candidates/search",
          { method: "POST", body: JSON.stringify({ jdText, limit, filters }) },
          a,
        ),
      ),

    compareCandidates: (jdText: string, candidateIds: string[]) =>
      withAuth((a) =>
        request<{ comparison: string; query: ParsedJD }>(
          "/candidates/compare",
          { method: "POST", body: JSON.stringify({ jdText, candidateIds }) },
          a,
        ),
      ),

    getCandidate: (id: string) =>
      withAuth((a) => request<Candidate>(`/candidates/${id}`, { method: "GET" }, a)),

    batchCandidates: (ids: string[]) =>
      withAuth((a) =>
        request<Candidate[]>("/candidates/batch", {
          method: "POST",
          body: JSON.stringify({ ids }),
        }, a),
      ),

    updateCandidateStatus: (candidateId: string, status: string) =>
      withAuth((a) =>
        request<{ message: string }>(`/candidates/${candidateId}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        }, a),
      ),

    addCandidateNote: (candidateId: string, noteText: string) =>
      withAuth((a) =>
        request<{ message: string }>(`/candidates/${candidateId}/notes`, {
          method: "POST",
          body: JSON.stringify({ noteText }),
        }, a),
      ),

    getCandidateNotes: (candidateId: string) =>
      withAuth((a) =>
        request<Array<{ id: string; note_text: string; created_at: string }>>(
          `/candidates/${candidateId}/notes`,
          { method: "GET" },
          a,
        ),
      ),

    getScreeningQuestions: (candidateId: string) =>
      withAuth((a) =>
        request<{ questions: Array<{ question: string; focus_area: string; why_this_matters: string }> }>(
          `/candidates/${candidateId}/screening-questions`,
          { method: "POST" },
          a,
        ),
      ),

    getClosingStrategy: (candidateId: string) =>
      withAuth((a) =>
        request<{ selling_points: Array<{ point: string; detail: string }>; major_objection: { objection: string; overcome_strategy: string } }>(
          `/candidates/${candidateId}/closing-strategy`,
          { method: "POST" },
          a,
        ),
      ),

    scanBias: (jdText: string) =>
      withAuth((a) =>
        request<BiasResult>("/scan-bias", {
          method: "POST",
          body: JSON.stringify({ jdText }),
        }, a),
      ),

    getSessions: () =>
      withAuth((a) => request<SessionSummary[]>("/sessions", { method: "GET" }, a)),

    getSessionStats: (sessionId: string) =>
      withAuth((a) => request<SessionStats>(`/sessions/${sessionId}/stats`, { method: "GET" }, a)),

    getAllCandidates: (params: {
      page?: number; limit?: number; search?: string; sortBy?: string;
      sortOrder?: "asc" | "desc"; sessionId?: string; status?: string;
    } = {}) =>
      withAuth((a) => {
        const searchParams = new URLSearchParams()
        if (params.page) searchParams.set("page", String(params.page))
        if (params.limit) searchParams.set("limit", String(params.limit))
        if (params.search) searchParams.set("search", params.search)
        if (params.sortBy) searchParams.set("sortBy", params.sortBy)
        if (params.sortOrder) searchParams.set("sortOrder", params.sortOrder)
        if (params.sessionId) searchParams.set("sessionId", params.sessionId)
        if (params.status) searchParams.set("status", params.status)
        const qs = searchParams.toString()
        return request<PaginatedCandidates>(`/candidates${qs ? `?${qs}` : ""}`, { method: "GET" }, a)
      }),

    getCandidateRecord: (id: string) =>
      withAuth((a) => request<CandidateRecord>(`/candidates/${id}`, { method: "GET" }, a)),

    scheduleInterview: (candidateId: string, data: {
      scheduledDate: string; scheduledTime: string; interviewType: string;
      interviewerName?: string; notes?: string;
    }) =>
      withAuth((a) =>
        request<InterviewData>(`/candidates/${candidateId}/interviews`, {
          method: "POST",
          body: JSON.stringify(data),
        }, a),
      ),

    getCandidateInterviews: (candidateId: string) =>
      withAuth((a) =>
        request<InterviewData[]>(`/candidates/${candidateId}/interviews`, { method: "GET" }, a),
      ),

    rescheduleInterview: (candidateId: string, interviewId: string, data: {
      scheduledDate?: string; scheduledTime?: string; interviewType?: string;
      interviewerName?: string; notes?: string; status?: string;
    }) =>
      withAuth((a) =>
        request<{ message: string }>(`/candidates/${candidateId}/interviews/${interviewId}`, {
          method: "PATCH",
          body: JSON.stringify(data),
        }, a),
      ),

    makeOffer: (candidateId: string, data: { salary?: number; joiningDate?: string; notes?: string }) =>
      withAuth((a) =>
        request<OfferData>(`/candidates/${candidateId}/offer`, {
          method: "POST",
          body: JSON.stringify(data),
        }, a),
      ),

    acceptOffer: (candidateId: string) =>
      withAuth((a) =>
        request<{ message: string }>(`/candidates/${candidateId}/hire`, { method: "POST" }, a),
      ),

    rejectCandidate: (candidateId: string, reason: string, notes?: string, changedBy?: string) =>
      withAuth((a) =>
        request<{ message: string }>(`/candidates/${candidateId}/reject`, {
          method: "POST",
          body: JSON.stringify({ reason, notes, changedBy }),
        }, a),
      ),

    generateEmailTemplate: (candidateId: string) =>
      withAuth((a) =>
        request<{ subject: string; body: string }>(`/candidates/${candidateId}/email-template`, { method: "POST" }, a),
      ),

    sendInterviewEmail: (candidateId: string, interviewId?: string, subject?: string, body?: string) =>
      withAuth((a) =>
        request<{ message: string; subject?: string; body?: string }>(`/candidates/${candidateId}/send-email`, {
          method: "POST",
          body: JSON.stringify({ interviewId, subject, body }),
        }, a),
      ),

    getCandidateTimeline: (candidateId: string) =>
      withAuth((a) =>
        request<TimelineEntry[]>(`/candidates/${candidateId}/timeline`, { method: "GET" }, a),
      ),

    generateLink: (jdText: string) =>
      withAuth((a) =>
        request<{ sessionId: string; link: string; createdAt: string }>("/generate-link", {
          method: "POST",
          body: JSON.stringify({ jdText }),
        }, a),
      ),

    getDashboard: (page = 1, limit = 50) =>
      withAuth((a) =>
        request<DashboardData>(`/dashboard?page=${page}&limit=${limit}`, { method: "GET" }, a),
      ),

    getCandidatesPage: (params: {
      page?: number; limit?: number; search?: string; sortBy?: string;
      sortOrder?: "asc" | "desc"; sessionId?: string; status?: string;
    } = {}) =>
      withAuth((a) => {
        const searchParams = new URLSearchParams()
        if (params.page) searchParams.set("page", String(params.page))
        if (params.limit) searchParams.set("limit", String(params.limit))
        if (params.search) searchParams.set("search", params.search)
        if (params.sortBy) searchParams.set("sortBy", params.sortBy)
        if (params.sortOrder) searchParams.set("sortOrder", params.sortOrder)
        if (params.sessionId) searchParams.set("sessionId", params.sessionId)
        if (params.status) searchParams.set("status", params.status)
        const qs = searchParams.toString()
        return request<CandidatesPageData>(`/candidates-page${qs ? `?${qs}` : ""}`, { method: "GET" }, a)
      }),

    markCandidateAsHired: (candidateId: string) =>
      withAuth((a) =>
        request<{ message: string }>(`/candidates/${candidateId}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: CANDIDATE_STATUS.HIRED }),
        }, a),
      ),
  }
}
