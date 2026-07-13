export const API_BASE = "/api"

export const ROUTES = {
  home: "/",
  dashboard: "/dashboard",
  candidates: "/candidates",
  candidateSearch: "/candidates/search",
  candidateDetail: (id: string) => `/candidates/${id}`,
  compare: "/compare",
  howItWorks: "/how-it-works",
} as const

export const STATUS_COLORS: Record<string, string> = {
  applied: "bg-blue-100 text-blue-700 border-blue-200",
  shortlisted: "bg-purple-100 text-purple-700 border-purple-200",
  screening: "bg-orange-100 text-orange-700 border-orange-200",
  "interview scheduled": "bg-yellow-100 text-yellow-700 border-yellow-200",
  "interview completed": "bg-yellow-100 text-yellow-700 border-yellow-200",
  "technical round": "bg-yellow-100 text-yellow-700 border-yellow-200",
  "hr round": "bg-yellow-100 text-yellow-700 border-yellow-200",
  offered: "bg-green-100 text-green-700 border-green-200",
  hired: "bg-emerald-100 text-emerald-700 border-emerald-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
}

export function getStatusColor(status?: string): string {
  const s = (status || "").toLowerCase()
  return STATUS_COLORS[s] || "bg-gray-100 text-gray-700 border-gray-200"
}
