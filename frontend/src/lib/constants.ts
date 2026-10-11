export const API_BASE = "/api"

export const ROUTES = {
  home: "/",
  dashboard: "/dashboard",
  candidates: "/candidates",
  candidateSearch: "/candidates/search",
  candidateDetail: (id: string) => `/candidates/${id}`,
  interview: "/interview",
  compare: "/compare",
  pools: "/pools",
  poolDetail: (id: string) => `/pools/${id}`,
  savedSearches: "/search",
  history: "/history",
  howItWorks: "/how-it-works",
  upload: (uuid: string) => `/upload/${uuid}`,
  assessments: "/assessments",
  assessmentNew: "/assessments/new",
  assessmentDetail: (id: string) => `/assessments/${id}`,
  assessmentTake: (token: string) => `/assessments/take/${token}`,
  candidateReport: "/candidate/report",
  settings: "/settings",
  performance: "/performance",
  signIn: "/sign-in",
  signUp: "/sign-up",
  jobs: "/jobs",
  jobDetail: (id: string) => `/jobs/${id}`,
  jobScreening: (id: string) => `/jobs/${id}/screening`,
} as const

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/candidates", label: "Candidates" },
  { href: "/candidates/search", label: "Search" },
  { href: "/jobs", label: "Jobs" },
  { href: "/pools", label: "Pools" },
  { href: "/compare", label: "Compare" },
  { href: "/interview", label: "Interviews" },
  { href: "/history", label: "History" },
] as const

// Backward compatibility re-exports
export { getStatusColor, CANDIDATE_STATUS, getFlightRiskColor, getInitials, formatDate, formatDateTime } from "./helpers"
