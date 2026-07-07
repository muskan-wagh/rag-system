"use client"

import { motion } from "framer-motion"
import type { Candidate } from "@/lib/api"

interface ComparisonViewProps {
  comparison: string
  candidates: Map<string, Candidate>
  candidateIds: string[]
}

export function ComparisonView({ comparison, candidates, candidateIds }: ComparisonViewProps) {
  const ids = candidateIds.filter(Boolean)
  const candidateA = ids[0] ? candidates.get(ids[0]) : null
  const candidateB = ids[1] ? candidates.get(ids[1]) : null

  if (!candidateA && !candidateB) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-border">
          {candidateA ? (
            <div className="text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mx-auto mb-3">
                <span className="text-lg font-semibold text-foreground/70">
                  {candidateA.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                </span>
              </div>
              <h3 className="text-base font-medium text-foreground">{candidateA.name}</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {candidateA.experience} yrs · {candidateA.skills.length} skills
              </p>
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">Candidate not loaded</div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 border border-border flex items-center justify-center">
          <div className="text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 mx-auto mb-3 ring-2 ring-primary/20">
              <span className="text-2xl font-bold text-primary">VS</span>
            </div>
          </div>
        </div>
      </div>

      {comparison && (
        <div className="bg-white rounded-2xl p-6 border border-border">
          <h3 className="text-sm font-medium text-foreground mb-4">AI Comparison</h3>
          <div className="prose prose-sm max-w-none text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {comparison}
          </div>
        </div>
      )}
    </motion.div>
  )
}
