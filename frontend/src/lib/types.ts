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

export interface NeedsReviewItem {
  id: string
  full_name: string | null
  current_title: string | null
  current_company: string | null
  match_score: number | null
  created_at: string | null
  days_since_applied: number
}

export interface AiRecommendation {
  id: string
  full_name: string | null
  current_title: string | null
  current_company: string | null
  match_score: number | null
  skills: string[]
}

export interface UpcomingInterview {
  id: string
  candidate_id: string
  candidate_name: string | null
  candidate_title: string | null
  interview_type: string
  scheduled_date: string
  scheduled_time: string
  status: string
  meeting_link: string
}

export interface RecentActivityItem {
  id: string
  type: "status_change" | "search" | "note" | "interview" | "upload" | "offer" | "view"
  description: string
  candidate_name: string | null
  created_at: string
}

export interface TopTalentPool {
  id: string
  name: string
  candidate_count: number
  average_score: number
  new_count: number
  updated_at: string
}

export interface QuickAction {
  id: string
  label: string
  description: string
  action: string
  icon: string
  priority: "high" | "medium" | "low"
}

export interface DashboardData {
  stats: SessionStats
  recentUploads: CandidateRecord[]
  sessions: Array<{
    id: string
    job_description_text: string
    created_at: string
  }>
  candidatesRequiringReview: NeedsReviewItem[]
  aiRecommendedCandidates: AiRecommendation[]
  upcomingInterviews: UpcomingInterview[]
  recentActivity: RecentActivityItem[]
  topTalentPools: TopTalentPool[]
  quickActions: QuickAction[]
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
  totalCandidates: number
  uploadedToday: number
  activeSessions: number
  searches: number
}

export interface CandidatesPageData {
  sessions: SessionSummary[]
  candidates: CandidateRecord[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface CandidateBriefNote {
  id: string
  note_text: string
  created_at: string
}

export interface CandidateBriefTimelineEntry {
  id: string
  status: string
  changed_at: string
  changed_by: string
  details: Record<string, unknown> | null
}

export interface CandidateBriefScores {
  skill: number
  experience: number
  education: number
  overall: number
}

export interface CandidateBriefRecord {
  fullName?: string
  email?: string
  phone?: string
  location?: string
  currentCompany?: string
  currentTitle?: string
  totalExperienceYears?: number
  rawResumeText?: string
  resumeFileUrl?: string
  flightRisk?: string
  growthTrajectory?: string
  currentStatus?: string
  createdAt?: string
}

export interface CandidateBrief {
  candidate: Candidate
  record: CandidateBriefRecord
  parsedResume: Record<string, unknown> | null
  notes: CandidateBriefNote[]
  timeline: CandidateBriefTimelineEntry[]
  similarCandidates: Candidate[]
  scores: CandidateBriefScores | null
}

export interface SavedSearch {
  id: string
  recruiter_id: string
  name: string
  jd_text: string
  filters: Record<string, unknown>
  is_favorite: boolean
  usage_count: number
  last_used_at: string | null
  created_at: string
  updated_at: string
}

export interface TalentPool {
  id: string
  recruiter_id: string
  saved_search_id: string | null
  name: string
  candidate_count: number
  new_count: number
  average_score: number
  highest_score: number
  created_at: string
  updated_at: string
  candidates?: PoolCandidate[]
}

export interface PoolCandidate {
  id: string
  pool_id: string
  candidate_id: string
  match_score: number
  added_at: string
  candidate_name?: string
  candidate_title?: string
  candidate_skills?: string[]
}

export interface SearchHistoryEntry {
  id: string
  recruiter_id: string
  jd_text: string
  filters: Record<string, unknown>
  result_count: number
  created_at: string
}

export interface PaginatedSearchHistory {
  entries: SearchHistoryEntry[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface HistoryEntry {
  id: string
  action_type: string
  description: string
  candidate_id: string | null
  candidate_name: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface PaginatedHistory {
  entries: HistoryEntry[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export type StatusFilter = 'open' | 'screening' | 'offered' | 'hired' | 'rejected' | 'all'
