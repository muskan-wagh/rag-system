"use client"

import { Search, Filter } from "lucide-react"
import { Input } from "@/components/ui/input"

const ACTION_TYPES = [
  { value: "", label: "All Activity" },
  { value: "status_changed", label: "Status Changes" },
  { value: "search_executed", label: "Searches" },
  { value: "interview_scheduled", label: "Interviews" },
  { value: "email_sent", label: "Emails" },
  { value: "offer_generated", label: "Offers" },
  { value: "note_added", label: "Notes" },
  { value: "resume_uploaded", label: "Uploads" },
  { value: "candidate_viewed", label: "Views" },
  { value: "candidate_compared", label: "Comparisons" },
  { value: "saved_search_created", label: "Saved Searches" },
  { value: "talent_pool_created", label: "Talent Pools" },
]

export function ActivityFilters({
  searchQuery,
  actionType,
  onSearchChange,
  onActionTypeChange,
}: {
  searchQuery: string
  actionType: string
  onSearchChange: (val: string) => void
  onActionTypeChange: (val: string) => void
}) {
  return (
    <div className="flex items-center gap-4 mb-8">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A3A3A3]" strokeWidth={1.5} />
        <input
          type="text"
          placeholder="Search activity..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full h-10 pl-9 pr-4 rounded-[12px] border border-[#ECECEC] bg-white text-sm text-[#111111] placeholder:text-[#A3A3A3] focus:outline-none focus:border-[#111111] transition-colors"
        />
      </div>
      <div className="relative">
        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A3A3A3]" strokeWidth={1.5} />
        <select
          value={actionType}
          onChange={(e) => onActionTypeChange(e.target.value)}
          className="h-10 pl-9 pr-8 rounded-[12px] border border-[#ECECEC] bg-white text-sm text-[#111111] appearance-none focus:outline-none focus:border-[#111111] transition-colors cursor-pointer"
        >
          {ACTION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
