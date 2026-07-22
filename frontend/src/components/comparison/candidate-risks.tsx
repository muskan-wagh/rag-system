"use client"

import { motion } from "framer-motion"
import { AlertTriangle, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ComparisonCandidate } from "@/lib/api"

interface CandidateRisksProps {
  candidates: ComparisonCandidate[]
}

export function CandidateRisks({ candidates }: CandidateRisksProps) {
  const hasRisks = candidates.some(c => c.risks.length > 0 || c.missingSkills.length > 0)
  if (!hasRisks) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.35 }}
      className="bg-white rounded-2xl border border-border p-5"
    >
      <h3 className="text-sm font-medium text-ink mb-4">Hiring Risks & Missing Skills</h3>

      <div className={cn(
        "grid gap-4",
        candidates.length === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1",
      )}>
        {candidates.map((candidate) => (
          <div key={candidate.candidateId} className="space-y-3">
            <p className="text-xs font-medium text-muted uppercase tracking-wider">{candidate.name}</p>

            {candidate.missingSkills.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <XCircle className="h-3.5 w-3.5 text-danger" strokeWidth={1.5} />
                  <span className="text-[11px] font-medium text-danger">Missing Skills</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {candidate.missingSkills.map((skill) => (
                    <Badge key={skill} variant="destructive" className="text-[11px]">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {candidate.risks.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" strokeWidth={1.5} />
                  <span className="text-[11px] font-medium text-amber-600">Risks</span>
                </div>
                <ul className="space-y-1">
                  {candidate.risks.map((risk, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-ink">
                      <span className="h-1 w-1 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                      {risk}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  )
}
