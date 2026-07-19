"use client"

import { AlertTriangle, TrendingUp, ShieldAlert } from "lucide-react"

interface RiskAssessmentCardProps {
  flightRisk?: string
  growthTrajectory?: string
  risks?: Array<{ risk: string; severity: "low" | "medium" | "high" }>
}

const severityColors: Record<string, string> = {
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  high: "bg-red-50 text-red-700 border-red-200",
}

const severityDot: Record<string, string> = {
  low: "bg-emerald-500",
  medium: "bg-amber-500",
  high: "bg-red-500",
}

export function RiskAssessmentCard({ flightRisk, growthTrajectory, risks }: RiskAssessmentCardProps) {
  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <div className="flex items-center gap-2 mb-3">
        <ShieldAlert className="h-4 w-4 text-[#1F4770]" />
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Risk Assessment</h3>
      </div>

      <div className="space-y-3">
        {flightRisk && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Flight Risk</span>
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              flightRisk === "low" ? "bg-emerald-50 text-emerald-700" :
              flightRisk === "high" ? "bg-red-50 text-red-700" :
              "bg-amber-50 text-amber-700"
            }`}>
              {flightRisk}
            </span>
          </div>
        )}

        {growthTrajectory && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Growth Trajectory</span>
            </div>
            <span className="text-xs font-medium text-emerald-600 capitalize">{growthTrajectory}</span>
          </div>
        )}

        {risks && risks.length > 0 && (
          <div className="border-t border-border pt-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Hiring Risks</p>
            <ul className="space-y-1.5">
              {risks.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${severityDot[r.severity] || "bg-muted"}`} />
                  <div className="flex-1">
                    <p className="text-muted-foreground">{r.risk}</p>
                    <span className={`inline-block mt-0.5 text-xs px-1.5 py-0.5 rounded border ${severityColors[r.severity] || "bg-muted text-muted-foreground"}`}>
                      {r.severity}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!flightRisk && !growthTrajectory && (!risks || risks.length === 0) && (
          <p className="text-sm text-muted-foreground">No risk data available.</p>
        )}
      </div>
    </div>
  )
}
