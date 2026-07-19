"use client"

import { CheckCircle2, XCircle, AlertCircle } from "lucide-react"

interface SkillCoverageCardProps {
  skills: string[]
  strengths?: string[]
  missingSkills?: string[]
}

export function SkillCoverageCard({ skills, strengths = [], missingSkills = [] }: SkillCoverageCardProps) {
  const hasHighlights = strengths.length > 0 || missingSkills.length > 0

  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Skill Coverage</h3>

      {skills.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2">{skills.length} skills identified</p>
          <div className="flex flex-wrap gap-1.5">
            {skills.map((skill) => (
              <span key={skill} className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-[#1F4770]/5 text-[#1F4770] rounded-md border border-[#1F4770]/10">
                <CheckCircle2 className="h-3 w-3" />
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {!hasHighlights && skills.length === 0 && (
        <p className="text-sm text-muted-foreground">No skills data available.</p>
      )}

      {hasHighlights && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {strengths.length > 0 && (
            <div>
              <p className="text-xs font-medium text-emerald-600 mb-1.5 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Strengths
              </p>
              <ul className="space-y-1">
                {strengths.map((s, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="text-emerald-500 mt-0.5">✓</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {missingSkills.length > 0 && (
            <div>
              <p className="text-xs font-medium text-amber-600 mb-1.5 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Missing
              </p>
              <ul className="space-y-1">
                {missingSkills.map((s, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <XCircle className="h-3 w-3 text-amber-400 mt-0.5 shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
