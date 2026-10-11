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
      <div className="bg-surface rounded-xl border border-border p-5 animate-pulse">
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
      <div className="bg-surface rounded-xl border border-border p-5">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-brand" />
          <h3 className="text-xs font-medium text-muted uppercase tracking-wider">AI Executive Summary</h3>
        </div>
        <p className="text-sm text-muted">Generate an AI hiring brief to see the executive summary.</p>
      </div>
    )
  }

  const confidenceLabel = confidenceScore !== undefined
    ? confidenceScore >= 0.8 ? "High" : confidenceScore >= 0.5 ? "Medium" : "Low"
    : null

  const recommendationColors: Record<string, string> = {
    "Strong Hire": "bg-success/10 text-success border-success",
    "Good Fit": "bg-info/10 text-info border-info",
    "Consider": "bg-warning/10 text-warning border-warning",
    "Weak Fit": "bg-danger/8 text-danger border-danger/25",
  }

  return (
    <div className="bg-surface rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand" />
          <h3 className="text-xs font-medium text-muted uppercase tracking-wider">AI Executive Summary</h3>
        </div>
        {recommendation && (
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${recommendationColors[recommendation] || "bg-muted text-muted"}`}>
            {recommendation}
          </span>
        )}
      </div>
      <p className="text-sm text-foreground leading-relaxed mb-3">{summary}</p>
      {confidenceLabel && (
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <span>Confidence:</span>
          <span className={`font-medium ${
            confidenceLabel === "High" ? "text-success" : confidenceLabel === "Medium" ? "text-warning" : "text-danger"
          }`}>
            {confidenceLabel}
          </span>
        </div>
      )}
    </div>
  )
}
