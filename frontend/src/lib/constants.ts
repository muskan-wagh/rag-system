export const API_BASE = "/api"

export const ROUTES = {
  home: "/",
  dashboard: "/dashboard",
  candidates: "/candidates",
  candidateDetail: (id: string) => `/candidates/${id}`,
  compare: "/compare",
  howItWorks: "/how-it-works",
} as const
