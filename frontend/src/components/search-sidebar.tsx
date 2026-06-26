"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { SlidersHorizontal, X } from "lucide-react"
import { useSearchStore } from "@/lib/search-store"
import type { SearchFilters } from "@/lib/api"

interface SearchSidebarProps {
  className?: string
}

export function SearchSidebar({ className }: SearchSidebarProps) {
  const filterFormValues = useSearchStore((s) => s.filterFormValues)
  const setFilterFormValues = useSearchStore((s) => s.setFilterFormValues)
  const setFilters = useSearchStore((s) => s.setFilters)

  function applyFilters() {
    const filters: SearchFilters = {}
    if (filterFormValues.minExp) filters.minExperience = parseInt(filterFormValues.minExp)
    if (filterFormValues.maxExp) filters.maxExperience = parseInt(filterFormValues.maxExp)
    if (filterFormValues.education) filters.educationLevel = filterFormValues.education
    if (filterFormValues.skills.trim()) filters.skills = filterFormValues.skills.split(",").map(s => s.trim()).filter(Boolean)
    setFilters(filters)
  }

  function clearFilters() {
    setFilterFormValues({ minExp: "", maxExp: "", education: "", skills: "" })
    setFilters({})
  }

  const hasFilters = filterFormValues.minExp || filterFormValues.maxExp || filterFormValues.education || filterFormValues.skills

  return (
    <motion.aside
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={className}
    >
      <div className="sticky top-20 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-foreground">Filters</h3>
          </div>
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Experience Range</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Min"
                value={filterFormValues.minExp}
                onChange={(e) => setFilterFormValues({ ...filterFormValues, minExp: e.target.value })}
                className="w-full bg-white rounded-lg border border-border px-3 py-1.5 text-xs text-foreground placeholder-muted-foreground/50 outline-none focus:border-primary/30 transition-colors"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <input
                type="number"
                placeholder="Max"
                value={filterFormValues.maxExp}
                onChange={(e) => setFilterFormValues({ ...filterFormValues, maxExp: e.target.value })}
                className="w-full bg-white rounded-lg border border-border px-3 py-1.5 text-xs text-foreground placeholder-muted-foreground/50 outline-none focus:border-primary/30 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Education Level</label>
            <select
              value={filterFormValues.education}
              onChange={(e) => setFilterFormValues({ ...filterFormValues, education: e.target.value })}
              className="w-full bg-white rounded-lg border border-border px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary/30 transition-colors"
            >
              <option value="">Any</option>
              <option value="high_school">High School</option>
              <option value="associate">Associate</option>
              <option value="bachelor">Bachelor</option>
              <option value="master">Master</option>
              <option value="phd">PhD</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Required Skills</label>
            <input
              placeholder="React, TypeScript, AWS..."
              value={filterFormValues.skills}
              onChange={(e) => setFilterFormValues({ ...filterFormValues, skills: e.target.value })}
              className="w-full bg-white rounded-lg border border-border px-3 py-1.5 text-xs text-foreground placeholder-muted-foreground/50 outline-none focus:border-primary/30 transition-colors"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Comma-separated list</p>
          </div>

          <Button
            onClick={applyFilters}
            size="sm"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-xs"
          >
            Apply Filters
          </Button>
        </div>
      </div>
    </motion.aside>
  )
}
