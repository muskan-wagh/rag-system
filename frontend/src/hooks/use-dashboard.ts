"use client"

import useSWR from "swr"
import { useApi } from "@/hooks/use-api"
import type { DashboardData, ApiResponse } from "@/lib/types"

const DASHBOARD_REFRESH_MS = 120_000

const SWR_OPTIONS = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  dedupingInterval: DASHBOARD_REFRESH_MS,
  refreshInterval: () =>
    typeof document !== "undefined" && document.visibilityState === "visible"
      ? DASHBOARD_REFRESH_MS
      : 0,
  errorRetryCount: 2,
  keepPreviousData: true,
}

// Single page size shared by dashboard + notifications so both hooks use the
// identical SWR key ["dashboard", 1, 8] and dedupe to ONE backend request.
export const DASHBOARD_PAGE_SIZE = 8

export function useDashboard(page = 1, limit = DASHBOARD_PAGE_SIZE) {
  const api = useApi()

  const { data, error, isLoading, isValidating, mutate } = useSWR<ApiResponse<DashboardData>>(
    ["dashboard", page, limit],
    () => api.getDashboard(page, limit),
    SWR_OPTIONS,
  )

  return {
    data: data?.data,
    stats: data?.data?.stats ?? null,
    candidates: data?.data?.recentUploads ?? [],
    sessions: data?.data?.sessions ?? [],
    candidatesRequiringReview: data?.data?.candidatesRequiringReview ?? [],
    aiRecommendedCandidates: data?.data?.aiRecommendedCandidates ?? [],
    upcomingInterviews: data?.data?.upcomingInterviews ?? [],
    recentActivity: data?.data?.recentActivity ?? [],
    topTalentPools: data?.data?.topTalentPools ?? [],
    quickActions: data?.data?.quickActions ?? [],
    isLoading,
    isValidating,
    error,
    mutate,
  }
}
