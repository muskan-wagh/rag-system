"use client"

import { Briefcase } from "lucide-react"

interface ExperienceAnalysisCardProps {
  totalYears: number
  currentTitle?: string
  currentCompany?: string
  weaknesses?: string[]
}

export function ExperienceAnalysisCard({ totalYears, currentTitle, currentCompany, weaknesses }: ExperienceAnalysisCardProps) {
  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <div className="flex items-center gap-2 mb-3">
        <Briefcase className="h-4 w-4 text-[#1F4770]" />
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Experience</h3>
      </div>

      <div className="flex items-baseline gap-1 mb-3">
        <span className="text-3xl font-bold text-foreground">{totalYears}</span>
        <span className="text-sm text-muted-foreground">years total</span>
      </div>

      {(currentTitle || currentCompany) && (
        <div className="text-sm text-muted-foreground mb-3">
          {currentTitle && <span className="font-medium text-foreground">{currentTitle}</span>}
          {currentTitle && currentCompany && <span> at </span>}
          {currentCompany && <span>{currentCompany}</span>}
        </div>
      )}

      {weaknesses && weaknesses.length > 0 && (
        <div className="border-t border-border pt-3 mt-3">
          <p className="text-xs font-medium text-amber-600 mb-1.5">Areas to probe</p>
          <ul className="space-y-1">
            {weaknesses.map((w, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                <span className="text-amber-400 mt-0.5">•</span>
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
