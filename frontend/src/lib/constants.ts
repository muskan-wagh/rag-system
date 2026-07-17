export const API_BASE = "/api"

export const ROUTES = {
  home: "/",
  dashboard: "/dashboard",
  candidates: "/candidates",
  candidateSearch: "/candidates/search",
  candidateDetail: (id: string) => `/candidates/${id}`,
  interview: "/interview",
  compare: "/compare",
  howItWorks: "/how-it-works",
  upload: (uuid: string) => `/upload/${uuid}`,
} as const

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/candidates", label: "Candidates" },
  { href: "/candidates/search", label: "Search" },
  { href: "/compare", label: "Compare" },
  { href: "/interview", label: "Interviews" },
] as const

// Backward compatibility re-exports
export { getStatusColor, getFlightRiskColor, getInitials, formatDate, formatDateTime } from "./helpers"
