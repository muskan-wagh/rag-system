"use client"

import { motion } from "framer-motion"
import { RadarChart } from "@/components/charts/radar-chart"
import { ProgressBar } from "@/components/ui/progress-bar"
import { Trophy, CheckCircle2, XCircle } from "lucide-react"
import type { Candidate } from "@/lib/api"

interface ComparisonViewProps {
  jdText: string
  comparison: string
  candidates: Map<string, Candidate>
  candidateIds: string[]
}

export function ComparisonView({ jdText, comparison, candidates, candidateIds }: ComparisonViewProps) {
  const ids = candidateIds.filter(Boolean)
  const candidateA = ids[0] ? candidates.get(ids[0]) : null
  const candidateB = ids[1] ? candidates.get(ids[1]) : null

  const radarData = [
    { label: "Skills", candidateA: 0.85, candidateB: 0.72 },
    { label: "Experience", candidateA: 0.70, candidateB: 0.88 },
    { label: "Education", candidateA: 0.90, candidateB: 0.65 },
    { label: "Overall", candidateA: 0.82, candidateB: 0.75 },
  ]

  if (!candidateA && !candidateB) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-border">
          {candidateA ? (
            <div className="text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mx-auto mb-3">
                <span className="text-lg font-semibold text-foreground/70">
                  {candidateA.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                </span>
              </div>
              <h3 className="text-base font-medium text-foreground">{candidateA.name}</h3>
              <p className="text-xs text-muted-foreground mt-1">Candidate A</p>
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">Candidate A not loaded</div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 border border-border flex items-center justify-center">
          <div className="text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 mx-auto mb-3 ring-2 ring-primary/20">
              <span className="text-2xl font-bold text-primary">VS</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-border">
          {candidateB ? (
            <div className="text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 mx-auto mb-3">
                <span className="text-lg font-semibold text-foreground/70">
                  {candidateB.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                </span>
              </div>
              <h3 className="text-base font-medium text-foreground">{candidateB.name}</h3>
              <p className="text-xs text-muted-foreground mt-1">Candidate B</p>
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">Candidate B not loaded</div>
          )}
        </div>
      </div>

      {candidateA && candidateB && (
        <>
          <div className="bg-white rounded-2xl p-6 border border-border">
            <div className="flex items-center justify-center gap-2 mb-6">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <span className="text-sm font-medium text-foreground">
                Winner: <span className="text-primary">{candidateA.name}</span>
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              <div className="space-y-4">
                <h4 className="text-xs font-medium text-foreground/70 uppercase tracking-wider">Score Comparison</h4>
                <div className="space-y-3">
                  <ProgressBar value={85} label="Skill Match" />
                  <ProgressBar value={70} label="Experience Match" color="bg-accent" />
                  <ProgressBar value={90} label="Education Match" color="bg-chart-3" />
                </div>
              </div>
              <RadarChart data={radarData} candidateALabel={candidateA.name} candidateBLabel={candidateB.name} />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-border">
            <h3 className="text-sm font-medium text-foreground mb-4">AI Recommendation</h3>
            <div className="prose prose-sm max-w-none text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {comparison}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-border">
              <h4 className="text-xs font-medium text-foreground mb-3 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                {candidateA.name} — Pros
              </h4>
              <ul className="space-y-1.5">
                {["Strong React expertise", "AWS certified", "Team lead experience"].map((pro) => (
                  <li key={pro} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                    {pro}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-border">
              <h4 className="text-xs font-medium text-foreground mb-3 flex items-center gap-1.5">
                <XCircle className="h-3.5 w-3.5 text-destructive/70" />
                {candidateB.name} — Cons
              </h4>
              <ul className="space-y-1.5">
                {["No GraphQL experience", "Less seniority"].map((con) => (
                  <li key={con} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <XCircle className="h-3 w-3 text-destructive/70 mt-0.5 shrink-0" />
                    {con}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </motion.div>
  )
}
