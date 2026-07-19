"use client"

import useSWR from "swr"
import { useApi } from "@/hooks/use-api"
import type { DashboardData, ApiResponse } from "@/lib/types"

const SWR_OPTIONS = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  dedupingInterval: 30_000,
  refreshInterval: 30_000,
  errorRetryCount: 2,
  keepPreviousData: true,
}

export function useDashboard(page = 1, limit = 50) {
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
