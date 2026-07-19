"use client"

import { GraduationCap } from "lucide-react"

interface EducationAnalysisCardProps {
  level: string
  field: string
  details?: string
}

export function EducationAnalysisCard({ level, field, details }: EducationAnalysisCardProps) {
  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <div className="flex items-center gap-2 mb-3">
        <GraduationCap className="h-4 w-4 text-[#1F4770]" />
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Education</h3>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1F4770]/10">
          <GraduationCap className="h-5 w-5 text-[#1F4770]" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground capitalize">
            {level || "N/A"}{field ? ` in ${field}` : ""}
          </p>
          {details && (
            <p className="text-xs text-muted-foreground mt-0.5">{details}</p>
          )}
        </div>
      </div>
    </div>
  )
}
