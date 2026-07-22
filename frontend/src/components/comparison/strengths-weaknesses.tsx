"use client"

import { motion } from "framer-motion"
import { CheckCircle2, XCircle, Lightbulb } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ComparisonCandidate } from "@/lib/api"

interface StrengthsWeaknessesProps {
  candidates: ComparisonCandidate[]
}

export function StrengthsWeaknesses({ candidates }: StrengthsWeaknessesProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="bg-white rounded-2xl border border-border p-5"
    >
      <h3 className="text-sm font-medium text-ink mb-4">Strengths & Weaknesses</h3>

      <div className={cn(
        "grid gap-4",
        candidates.length === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1",
      )}>
        {candidates.map((candidate, idx) => (
          <div key={candidate.candidateId} className="space-y-3">
            <p className="text-xs font-medium text-muted uppercase tracking-wider">
              {candidate.name}
            </p>

            {candidate.strengths.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" strokeWidth={1.5} />
                  <span className="text-[11px] font-medium text-success">Strengths</span>
                </div>
                <ul className="space-y-1">
                  {candidate.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-ink">
                      <span className="h-1 w-1 rounded-full bg-success/50 mt-1.5 shrink-0" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {candidate.weaknesses.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <XCircle className="h-3.5 w-3.5 text-danger" strokeWidth={1.5} />
                  <span className="text-[11px] font-medium text-danger">Weaknesses</span>
                </div>
                <ul className="space-y-1">
                  {candidate.weaknesses.map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-ink">
                      <span className="h-1 w-1 rounded-full bg-danger/50 mt-1.5 shrink-0" />
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {candidate.verdict && (
              <div className="flex items-start gap-2 pt-1">
                <Lightbulb className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" strokeWidth={1.5} />
                <p className="text-xs text-muted leading-relaxed">{candidate.verdict}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  )
}
