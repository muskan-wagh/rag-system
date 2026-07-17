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

export interface BiasResult {
  has_bias: boolean
  issues: Array<{ category: string; text: string; suggestion: string }>
  suggestions: string[]
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  details?: unknown
}

export interface SessionSummary {
  id: string
  job_description_text: string
  created_at: string
  candidate_count: number
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

export interface CandidatesPageData {
  sessions: SessionSummary[]
  candidates: CandidateRecord[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export type StatusFilter = 'open' | 'screening' | 'offered' | 'hired' | 'rejected' | 'all'
