"use client"

import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { Layers, User } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ComparisonSkillOverlap, ComparisonCandidate } from "@/lib/api"

interface SkillOverlapProps {
  skillOverlap: ComparisonSkillOverlap
  candidates: ComparisonCandidate[]
}

export function SkillOverlap({ skillOverlap, candidates }: SkillOverlapProps) {
  if (skillOverlap.shared.length === 0 && Object.keys(skillOverlap.unique).length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="bg-white rounded-2xl border border-border p-5"
    >
      <h3 className="text-sm font-medium text-ink mb-4">Skill Coverage</h3>

      {skillOverlap.shared.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Layers className="h-3.5 w-3.5 text-blue-500" strokeWidth={1.5} />
            <span className="text-[11px] font-medium text-blue-600 uppercase tracking-wider">Shared Skills</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {skillOverlap.shared.map((skill) => (
              <Badge key={skill} variant="secondary" className="text-[11px]">
                {skill}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className={cn(
        "grid gap-4",
        candidates.length === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1",
      )}>
        {candidates.map((candidate) => {
          const uniqueSkills = skillOverlap.unique[candidate.candidateId]
          if (!uniqueSkills || uniqueSkills.length === 0) return null
          return (
            <div key={candidate.candidateId}>
              <div className="flex items-center gap-1.5 mb-2">
                <User className="h-3.5 w-3.5 text-amber-500" strokeWidth={1.5} />
                <span className="text-[11px] font-medium text-amber-600 uppercase tracking-wider">
                  {candidate.name.split(" ")[0]}&apos;s unique skills
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {uniqueSkills.map((skill) => (
                  <Badge key={skill} variant="warning" className="text-[11px]">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}
