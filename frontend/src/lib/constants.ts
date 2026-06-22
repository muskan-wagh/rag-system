export const API_BASE = "/api"

export const ROUTES = {
  home: "/",
  dashboard: "/dashboard",
  candidates: "/candidates",
  candidateDetail: (id: string) => `/candidates/${id}`,
  compare: "/compare",
  recruiterChat: "/recruiter-chat",
  analytics: "/analytics",
} as const
