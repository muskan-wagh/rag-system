"use client"

import { useState, useCallback } from "react"
import useSWR from "swr"
import { useApi } from "@/hooks/use-api"
import { ActivityFilters } from "@/components/history/activity-filters"
import { ActivityFeed } from "@/components/history/activity-feed"
import { PageHeader } from "@/components/ui/page-header"
import type { PaginatedHistory } from "@/lib/types"

export default function HistoryPage() {
  const api = useApi()
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState("")
  const [actionType, setActionType] = useState("")
  const limit = 20

  const { data, isLoading } = useSWR(
    ["history", page, actionType, searchQuery],
    () => api.getHistory({ page, limit, actionType: actionType || undefined, search: searchQuery || undefined }),
    { revalidateOnFocus: false, keepPreviousData: true },
  )

  const historyData = data?.data as PaginatedHistory | undefined
  const entries = historyData?.entries ?? []
  const total = historyData?.total ?? 0
  const totalPages = historyData?.totalPages ?? 1

  const handlePageChange = useCallback((p: number) => {
    setPage(p)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  const handleSearchChange = useCallback((val: string) => {
    setSearchQuery(val)
    setPage(1)
  }, [])

  const handleActionTypeChange = useCallback((val: string) => {
    setActionType(val)
    setPage(1)
  }, [])

  return (
    <div className="space-y-8">
      <PageHeader
        title="Activity History"
        description="Every recruiter action, search, and update in one timeline"
      />

      <ActivityFilters
        searchQuery={searchQuery}
        actionType={actionType}
        onSearchChange={handleSearchChange}
        onActionTypeChange={handleActionTypeChange}
      />

      <ActivityFeed
        entries={entries}
        total={total}
        page={page}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        isLoading={isLoading}
      />
    </div>
  )
}
