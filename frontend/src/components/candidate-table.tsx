"use client"

import { motion } from "framer-motion"
import { FlightRiskBadge } from "./flight-risk-badge"

interface CandidateRow {
  id: string
  full_name?: string
  current_company?: string
  total_experience_years?: number
  flight_risk?: string
  growth_trajectory?: string
  match_score?: number
}

interface CandidateTableProps {
  candidates: CandidateRow[]
  loading: boolean
  onSelect: (candidate: CandidateRow) => void
}

export function CandidateTable({ candidates, loading, onSelect }: CandidateTableProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-4 border border-border animate-pulse">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 bg-muted rounded" />
                <div className="h-3 w-24 bg-muted rounded" />
              </div>
              <div className="h-6 w-20 bg-muted rounded-full" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (candidates.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">No candidates yet. Share the link to start receiving applications.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {candidates.map((candidate, i) => (
        <motion.button
          key={candidate.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03 }}
          onClick={() => onSelect(candidate)}
          className="w-full text-left bg-white rounded-xl p-4 border border-border hover:border-primary/20 hover:shadow-sm transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary shrink-0">
              {(candidate.full_name || "?")
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {candidate.full_name || "Unknown"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {candidate.current_company || "Company not listed"}
                {candidate.total_experience_years
                  ? ` · ${candidate.total_experience_years} yrs`
                  : ""}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {candidate.flight_risk && (
                <FlightRiskBadge risk={candidate.flight_risk} />
              )}
              {candidate.match_score !== undefined && (
                <div className="flex items-center gap-1.5">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">
                      {Math.round(candidate.match_score * 100)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.button>
      ))}
    </div>
  )
}
