export interface ComparisonCandidateScore {
  overall: number
  technical: number
  experience: number
  education: number
  culture: number
  leadership: number
  communication: number
}

export interface ComparisonCandidate {
  candidateId: string
  name: string
  title: string
  company: string
  location: string
  experience: number
  education: { level: string; field: string }
  skills: string[]
  scores: ComparisonCandidateScore
  strengths: string[]
  weaknesses: string[]
  missingSkills: string[]
  risks: string[]
  verdict: string
}

export interface ComparisonRecommendation {
  candidateId: string
  reasoning: string
}

export interface ComparisonSkillOverlap {
  shared: string[]
  unique: Record<string, string[]>
}

export interface CompareResult {
  candidates: ComparisonCandidate[]
  recommendation: ComparisonRecommendation
  summary: string
  interviewQuestions: string[]
  skillOverlap: ComparisonSkillOverlap
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
  /** Candidates currently in the Assessment stage. */
  assessment: number
  /** Candidates currently in the Technical Round stage. */
  technical: number
  /** Candidates currently in the Interview stage. */
  hr: number
  /** Candidates currently awaiting a final hiring decision. */
  finalDecision: number
  /** Backwards-compatible aggregate of `technical + hr`. */
  interview: number
  interviewsToday: number
  offered: number
  hired: number
  rejected: number
  /** Candidates parked on Hold or Withdrawn. */
  onHold: number
  /** Historical screening outcomes — event-based, NOT current stage. */
  screeningPassed: number
  screeningFailed: number
  screeningTotal: number
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

// === Recruiter Assessment Builder ===

export type AssessmentStatus = 'draft' | 'published'
export type AssessmentQuestionType = 'mcq' | 'coding' | 'sql' | 'subjective'

export interface MinimalJob {
  id: string
  title: string
  description?: string
  upload_session_id?: string | null
  created_at?: string
  /**
   * Job lifecycle. A closed job accepts no new applications, invitations or
   * progression, but every existing record stays readable — closing a job stops
   * intake, it does not erase history.
   */
  status?: "open" | "closed"
  closed_at?: string | null
  /** Per-job automation rules, including the closed-job invite override. */
  progression_config?: Record<string, boolean>
}

// ─────────────────────────────────────────────────────────────────────────────
// Recruitment workspace
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derived, per-candidate assessment state.
 *
 * Every value is backed by a real row. In particular `failed` means a recorded
 * delivery failure — never "we gave up", and never a quiet success.
 */
export type AssessmentState =
  | "not_created"
  | "draft"
  | "ready_to_send"
  | "invited"
  | "in_progress"
  | "completed"
  | "expired"
  | "failed"

export const ASSESSMENT_STATE_LABELS: Record<AssessmentState, string> = {
  not_created: "Not created",
  draft: "Draft",
  ready_to_send: "Ready to send",
  invited: "Invited",
  in_progress: "In progress",
  completed: "Completed",
  expired: "Expired",
  failed: "Failed",
}

export interface WorkspaceCandidate {
  applicationId: string
  candidateId: string
  fullName: string
  email: string
  currentTitle: string
  currentCompany: string
  stage: string
  stageChangedAt: string | null
  shortlistedAt: string | null
  screening: {
    status: string
    overall: number
    overridden: boolean
    matchedSkills: string[]
    missingSkills: string[]
  } | null
  assessment: {
    state: AssessmentState
    assessmentId: string | null
    assessmentName: string | null
    /** Published question version this link is pinned to. */
    snapshotVersion: number | null
    inviteStatus: string | null
    deliveryStatus: "pending" | "sent" | "failed" | null
    sentAt: string | null
    deadline: string | null
    attemptStatus: string | null
    startedAt: string | null
    submittedAt: string | null
    score: number | null
    maxScore: number | null
    percentage: number | null
    passed: boolean | null
  } | null
  interview: {
    interviewId: string
    scheduledDate: string
    scheduledTime: string
    status: string
    meetingLink: string
  } | null
  hasReport: boolean
}

export interface WorkspaceCounts {
  applied: number
  screening: number
  shortlisted: number
  assessment: number
  technicalRound: number
  interview: number
  finalDecision: number
  hired: number
  rejected: number
  hold: number
  notCreated: number
  draft: number
  readyToSend: number
  invited: number
  inProgress: number
  completed: number
  expired: number
  failed: number
}

export interface WorkspaceAssessmentSummary {
  id: string
  name: string
  status: string
  durationMinutes: number
  passingScore: number
  /** Published question version. 0 means never published under snapshotting. */
  snapshotVersion: number
  totalQuestions: number
  totalMarks: number
  availableUntil: string | null
  inviteCount: number
}

export interface WorkspacePayload {
  job: {
    id: string
    title: string
    status: "open" | "closed"
    closed_at: string | null
    closed_by: string | null
    assessmentCount: number
    publishedAssessmentCount: number
    shortlistedCount: number
  }
  counts: WorkspaceCounts
  /** Job-scoped: never contains a candidate from another job. */
  pipeline: WorkspaceCandidate[]
  assessments: WorkspaceAssessmentSummary[]
  /** True when the job refuses new recruitment activity. */
  readOnly: boolean
  /** Whether an authorized invite override is configured for a closed job. */
  invitesAllowedWhenClosed: boolean
}

export interface ShortlistEligibility {
  eligible: boolean
  reason?: string
  currentStage: string | null
  applicationId: string | null
  screening: { status: string; overall: number; overridden: boolean } | null
}

export interface ShortlistResult {
  applicationId: string
  jobId: string
  candidateId: string
  stage: string
  previousStage: string
  changed: boolean
  deduplicated: boolean
  usedOverride: boolean
  screeningScore: number | null
  shortlistedAt: string | null
  message: string
}

export interface DecisionResult {
  applicationId: string
  fromStage: string
  toStage: string
  changed: boolean
  deduplicated: boolean
  interviewId?: string
  interviewLink?: string
  availableDecisions: string[]
  message: string
}

export interface JourneyStep {
  key: string
  label: string
  state: "completed" | "current" | "upcoming" | "blocked"
  at: string | null
  detail: string | null
  href: string | null
}

export interface CandidateJourney {
  job: { id: string; title: string; status: string }
  application: { id: string; stage: string; stageChangedAt: string | null }
  steps: JourneyStep[]
}

export interface ApplicationContext {
  job: { id: string; title: string; status: "open" | "closed" }
  readOnly: boolean
  application: {
    id: string
    stage: string
    stageChangedAt: string | null
    shortlistedAt: string | null
    shortlistedBy: string | null
    shortlistNote: string
    source: string
    appliedAt: string
  }
  screening: WorkspaceCandidate["screening"]
  assessment: WorkspaceCandidate["assessment"]
  interview: WorkspaceCandidate["interview"]
  availableDecisions: string[]
}

export interface AssessmentSettings {
  randomize_questions?: boolean
  allow_revisit?: boolean
  auto_submit?: boolean
}

export interface McqOption {
  id: string
  text: string
}

export interface AssessmentQuestion {
  id: string
  assessment_id: string
  type: AssessmentQuestionType
  position: number
  title: string
  prompt: string
  payload: Record<string, unknown>
  marks: number
  skill_tag: string
  is_required: boolean
  created_at?: string
}

export interface Assessment {
  id: string
  job_id: string | null
  hiring_stage_id: string | null
  name: string
  description: string
  instructions: string
  duration_minutes: number
  passing_score: number
  skills: string[]
  status: AssessmentStatus
  settings: AssessmentSettings
  available_from: string | null
  available_until: string | null
  totalQuestions: number
  totalMarks: number
  created_at?: string
  updated_at?: string
}

export interface AssessmentDetail extends Assessment {
  questions: AssessmentQuestion[]
  job: { id: string; title: string } | null
  inviteCount: number
}

export interface CandidateInviteState {
  status: string
  sent_at: string
  last_sent_at: string
  send_count: number
}

export interface EligibleCandidate extends CandidateRecord {
  invite: CandidateInviteState | null
  screening: { status: string; overall: number } | null
}

export interface AssessmentInvite {
  id: string
  candidate_id: string
  email: string
  status: string
  available_from: string | null
  available_until: string | null
  sent_at: string
  last_sent_at: string
  send_count: number
  created_at: string
  candidates?: { full_name?: string; email?: string } | null
}

export interface InviteResult {
  invited: Array<{ candidateId: string; email: string; link: string; sentAt: string }>
  skippedAlreadyInvited: string[]
  skippedMissingEmail: string[]
  /**
   * Invitations whose record could not be created. These used to be dropped
   * silently, so a request could report success for a candidate who was never
   * actually invited.
   */
  failed: Array<{ candidateId: string; reason: string }>
  /** Published question version every invitation in this batch is pinned to. */
  snapshotVersion: number
}
