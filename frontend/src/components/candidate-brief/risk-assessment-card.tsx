"use client"

import { AlertTriangle, TrendingUp, ShieldAlert } from "lucide-react"

interface RiskAssessmentCardProps {
  flightRisk?: string
  growthTrajectory?: string
  risks?: Array<{ risk: string; severity: "low" | "medium" | "high" }>
}

const severityColors: Record<string, string> = {
  low: "bg-success/10 text-success border-success",
  medium: "bg-warning/10 text-warning border-warning",
  high: "bg-danger/8 text-danger border-danger/25",
}

const severityDot: Record<string, string> = {
  low: "bg-success",
  medium: "bg-warning",
  high: "bg-danger",
}

export function RiskAssessmentCard({ flightRisk, growthTrajectory, risks }: RiskAssessmentCardProps) {
  return (
    <div className="bg-surface rounded-xl border border-border p-5">
      <div className="flex items-center gap-2 mb-3">
        <ShieldAlert className="h-4 w-4 text-brand" />
        <h3 className="text-xs font-medium text-muted uppercase tracking-wider">Risk Assessment</h3>
      </div>

      <div className="space-y-3">
        {flightRisk && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Flight Risk</span>
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              flightRisk === "low" ? "bg-success/10 text-success" :
              flightRisk === "high" ? "bg-danger/8 text-danger" :
              "bg-warning/10 text-warning"
            }`}>
              {flightRisk}
            </span>
          </div>
        )}

        {growthTrajectory && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Growth Trajectory</span>
            </div>
            <span className="text-xs font-medium text-success capitalize">{growthTrajectory}</span>
          </div>
        )}

        {risks && risks.length > 0 && (
          <div className="border-t border-border pt-3">
            <p className="text-xs font-medium text-muted mb-2">Hiring Risks</p>
            <ul className="space-y-1.5">
              {risks.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${severityDot[r.severity] || "bg-muted"}`} />
                  <div className="flex-1">
                    <p className="text-muted">{r.risk}</p>
                    <span className={`inline-block mt-0.5 text-xs px-1.5 py-0.5 rounded border ${severityColors[r.severity] || "bg-muted text-muted"}`}>
                      {r.severity}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!flightRisk && !growthTrajectory && (!risks || risks.length === 0) && (
          <p className="text-sm text-muted">No risk data available.</p>
        )}
      </div>
    </div>
  )
}
