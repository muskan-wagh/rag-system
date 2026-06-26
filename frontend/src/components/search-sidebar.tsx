"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { SlidersHorizontal, X } from "lucide-react"
import type { SearchFilters } from "@/lib/api"

interface SearchSidebarProps {
  onFiltersChange: (filters: SearchFilters) => void
  className?: string
}

export function SearchSidebar({ onFiltersChange, className }: SearchSidebarProps) {
  const [minExp, setMinExp] = useState("")
  const [maxExp, setMaxExp] = useState("")
  const [education, setEducation] = useState("")
  const [skills, setSkills] = useState("")

  function applyFilters() {
    const filters: SearchFilters = {}
    if (minExp) filters.minExperience = parseInt(minExp)
    if (maxExp) filters.maxExperience = parseInt(maxExp)
    if (education) filters.educationLevel = education
    if (skills.trim()) filters.skills = skills.split(",").map(s => s.trim()).filter(Boolean)
    onFiltersChange(filters)
  }

  function clearFilters() {
    setMinExp("")
    setMaxExp("")
    setEducation("")
    setSkills("")
    onFiltersChange({})
  }

  const hasFilters = minExp || maxExp || education || skills

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
                value={minExp}
                onChange={(e) => setMinExp(e.target.value)}
                className="w-full bg-white rounded-lg border border-border px-3 py-1.5 text-xs text-foreground placeholder-muted-foreground/50 outline-none focus:border-primary/30 transition-colors"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <input
                type="number"
                placeholder="Max"
                value={maxExp}
                onChange={(e) => setMaxExp(e.target.value)}
                className="w-full bg-white rounded-lg border border-border px-3 py-1.5 text-xs text-foreground placeholder-muted-foreground/50 outline-none focus:border-primary/30 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Education Level</label>
            <select
              value={education}
              onChange={(e) => setEducation(e.target.value)}
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
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
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
