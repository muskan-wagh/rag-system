export const API_BASE = "/api"

export const ROUTES = {
  home: "/",
  dashboard: "/dashboard",
  candidates: "/candidates",
  candidateSearch: "/candidates/search",
  candidateDetail: (id: string) => `/candidates/${id}`,
  compare: "/compare",
  pools: "/pools",
  poolDetail: (id: string) => `/pools/${id}`,
  savedSearches: "/search",
  history: "/history",
  howItWorks: "/how-it-works",
  upload: (uuid: string) => `/upload/${uuid}`,
  /**
   * The Assessments workspace. It is the single place a recruiter manages a
   * candidate from screening through to the final hiring decision.
   *
   * The standalone `/jobs`, `/jobs/[id]`, `/jobs/[id]/screening` and `/interview`
   * pages were removed: jobs are created and opened/closed from the workspace's
   * Jobs tab, and the technical/coding/interview stages live inside it as
   * connected steps rather than a disconnected section.
   */
  assessments: "/assessments",
  assessmentNew: "/assessments/new",
  assessmentDetail: (id: string) => `/assessments/${id}`,
  assessmentTake: (token: string) => `/assessments/take/${token}`,
  /** Deep link into a specific job's pipeline and stage. */
  workspace: (jobId?: string, stage?: string) => {
    const params = new URLSearchParams()
    if (jobId) params.set("job", jobId)
    if (stage) params.set("stage", stage)
    const qs = params.toString()
    return qs ? `${ROUTES.assessments}?${qs}` : ROUTES.assessments
  },
  candidateReport: "/candidate/report",
  settings: "/settings",
  performance: "/performance",
  signIn: "/sign-in",
  signUp: "/sign-up",
} as const

/**
 * Legacy route fragments. Kept so any straggling link redirects instead of
 * 404-ing; there is deliberately no sidebar entry for any of them.
 */
export const RETIRED_ROUTES = {
  jobs: "/jobs",
  interview: "/interview",
} as const

/** Stages the workspace tabs expose, in pipeline order. */
export const WORKSPACE_STAGES = [
  "jobs",
  "shortlisting",
  "setup",
  "invitations",
  "results",
  "technical",
  "interview",
] as const

export type WorkspaceStage = (typeof WORKSPACE_STAGES)[number]

export const WORKSPACE_STAGE_META: Record<
  WorkspaceStage,
  { label: string; description: string }
> = {
  jobs: {
    label: "Jobs",
    description: "Create roles, and open or close intake.",
  },
  shortlisting: {
    label: "Shortlisting",
    description: "Review screened candidates and shortlist them for this job.",
  },
  setup: {
    label: "Assessment setup",
    description: "Generate, edit and approve this job's assessment.",
  },
  invitations: {
    label: "Invitations",
    description: "Send each shortlisted candidate their own assessment link.",
  },
  results: {
    label: "Results",
    description: "Track attempts, scores and candidate reports.",
  },
  technical: {
    label: "Technical round",
    description: "Advance candidates, schedule interviews and run live coding.",
  },
  interview: {
    label: "Interview & decision",
    description: "Run interview rounds, review feedback, and hire or reject.",
  },
}
// Backward compatibility re-exports. Several modules historically imported
// these from `constants` rather than from their real home.
export {
  getStatusColor,
  CANDIDATE_STATUS,
  getFlightRiskColor,
  getInitials,
  formatDate,
  formatDateTime,
} from "./helpers"
