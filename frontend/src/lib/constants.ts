export const API_BASE = "/api"

export const ROUTES = {
  home: "/",
  candidates: "/candidates",
  candidateDetail: (id: string) => `/candidates/${id}`,
  compare: "/compare",
} as const
