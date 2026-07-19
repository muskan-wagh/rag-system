"use client"

import { Sparkles } from "lucide-react"

interface ExecutiveSummaryCardProps {
  summary?: string
  recommendation?: string
  confidenceScore?: number
  isLoading?: boolean
}

export function ExecutiveSummaryCard({ summary, recommendation, confidenceScore, isLoading }: ExecutiveSummaryCardProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-border p-5 animate-pulse">
        <div className="h-3 w-24 bg-muted rounded mb-3" />
        <div className="space-y-2">
          <div className="h-3 bg-muted rounded w-full" />
          <div className="h-3 bg-muted rounded w-3/4" />
        </div>
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="bg-white rounded-xl border border-border p-5">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-[#1F4770]" />
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">AI Executive Summary</h3>
        </div>
        <p className="text-sm text-muted-foreground">Generate an AI hiring brief to see the executive summary.</p>
      </div>
    )
  }

  const confidenceLabel = confidenceScore !== undefined
    ? confidenceScore >= 0.8 ? "High" : confidenceScore >= 0.5 ? "Medium" : "Low"
    : null

  const recommendationColors: Record<string, string> = {
    "Strong Hire": "bg-emerald-50 text-emerald-700 border-emerald-200",
    "Good Fit": "bg-blue-50 text-blue-700 border-blue-200",
    "Consider": "bg-amber-50 text-amber-700 border-amber-200",
    "Weak Fit": "bg-red-50 text-red-700 border-red-200",
  }

  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#1F4770]" />
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">AI Executive Summary</h3>
        </div>
        {recommendation && (
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${recommendationColors[recommendation] || "bg-muted text-muted-foreground"}`}>
            {recommendation}
          </span>
        )}
      </div>
      <p className="text-sm text-foreground leading-relaxed mb-3">{summary}</p>
      {confidenceLabel && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Confidence:</span>
          <span className={`font-medium ${
            confidenceLabel === "High" ? "text-emerald-600" : confidenceLabel === "Medium" ? "text-amber-600" : "text-red-600"
          }`}>
            {confidenceLabel}
          </span>
        </div>
      )}
    </div>
  )
}
