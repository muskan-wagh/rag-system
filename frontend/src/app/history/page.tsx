"use client"

import { useState, useCallback } from "react"
import { motion } from "framer-motion"
import { History } from "lucide-react"
import useSWR from "swr"
import { useApi } from "@/hooks/use-api"
import { ActivityFilters } from "@/components/history/activity-filters"
import { ActivityFeed } from "@/components/history/activity-feed"
import type { PaginatedHistory } from "@/lib/types"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const } },
}

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
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="pt-6"
    >
      <motion.div variants={itemVariants}>
          <div className="flex items-center gap-4 mb-2">
          <div className="h-10 w-10 rounded-[10px] bg-surface-secondary flex items-center justify-center">
            <History className="h-5 w-5 text-text-primary" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-lg font-medium text-text-primary" style={{ letterSpacing: "-0.01em", fontFamily: "var(--font-inter)" }}>Activity History</h1>
            <p className="text-sm text-text-secondary mt-0.5" style={{ fontFamily: "var(--font-inter)" }}>Every recruiter action, search, and update in one timeline</p>
          </div>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="mt-6">
        <ActivityFilters
          searchQuery={searchQuery}
          actionType={actionType}
          onSearchChange={handleSearchChange}
          onActionTypeChange={handleActionTypeChange}
        />
      </motion.div>

      <motion.div variants={itemVariants}>
        <ActivityFeed
          entries={entries}
          total={total}
          page={page}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          isLoading={isLoading}
        />
      </motion.div>
    </motion.div>
  )
}
