"use client"

import { motion } from "framer-motion"
import { Lightbulb, TrendingUp, Award, Users, Brain } from "lucide-react"
import type { RankingResult } from "@/lib/api"

interface AiInsightsPanelProps {
  results: RankingResult[]
  jdText: string
}

export function AiInsightsPanel({ results, jdText }: AiInsightsPanelProps) {
  if (results.length === 0) return null

  const avgScore = results.reduce((sum, r) => sum + r.scores.overall, 0) / results.length
  const topName = results[0].candidate.name
  const avgExp = results.reduce((sum, r) => sum + r.candidate.experience, 0) / results.length

  const topSkills = new Map<string, number>()
  results.forEach((r) => {
    r.candidate.skills.forEach((s) => topSkills.set(s, (topSkills.get(s) || 0) + 1))
  })
  const commonSkills = [...topSkills.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
  const maxSkillCount = commonSkills[0]?.[1] || 1

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      <div className="bg-surface rounded-lg p-5 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink/10">
            <Lightbulb className="h-3.5 w-3.5 text-ink" />
          </div>
          <h3 className="text-sm font-medium text-ink">AI Insights</h3>
        </div>
        <div className="space-y-3 text-xs">
          <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-ink/[0.02]">
            <Award className="h-3.5 w-3.5 text-ink mt-0.5 shrink-0" />
            <p className="text-muted">
              Top match: <span className="font-medium text-ink">{topName}</span> at{" "}
              {Math.round(results[0].scores.overall * 100)}% fit
            </p>
          </div>
          <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-accent/[0.02]">
            <TrendingUp className="h-3.5 w-3.5 text-accent mt-0.5 shrink-0" />
            <p className="text-muted">
              Average match: <span className="font-medium text-ink">{Math.round(avgScore * 100)}%</span> across {results.length} candidates
            </p>
          </div>
          <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-chart-3/[0.02]">
            <Users className="h-3.5 w-3.5 text-chart-3 mt-0.5 shrink-0" />
            <p className="text-muted">
              Avg experience: <span className="font-medium text-ink">{avgExp.toFixed(1)} years</span>
            </p>
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-lg p-5 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="h-4 w-4 text-ink" />
          <h3 className="text-sm font-medium text-ink">Top Skills</h3>
        </div>
        <div className="space-y-2.5">
          {commonSkills.map(([skill, count]) => (
            <div key={skill} className="flex items-center justify-between text-xs">
              <span className="text-muted w-24 truncate">{skill}</span>
              <div className="flex-1 mx-3">
                <div className="h-1.5 rounded-full bg-surface-secondary overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(count / maxSkillCount) * 100}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full rounded-full bg-ink"
                  />
                </div>
              </div>
              <span className="text-muted w-4 text-right font-medium">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-surface rounded-lg p-5 border border-border">
        <h3 className="text-sm font-medium text-ink mb-4">Score Distribution</h3>
        <div className="space-y-3">
          {[
            { label: "0-40%", count: results.filter(r => r.scores.overall < 0.4).length, color: "bg-faint/40" },
            { label: "40-60%", count: results.filter(r => r.scores.overall >= 0.4 && r.scores.overall < 0.6).length, color: "bg-info/60" },
            { label: "60-80%", count: results.filter(r => r.scores.overall >= 0.6 && r.scores.overall < 0.8).length, color: "bg-warning/60" },
            { label: "80-100%", count: results.filter(r => r.scores.overall >= 0.8).length, color: "bg-success/70" },
          ].map((bin) => {
            return (
              <div key={bin.label} className="flex items-center gap-2 text-xs">
                <span className="text-muted w-12">{bin.label}</span>
                <div className="flex-1 h-5 rounded-md bg-surface-secondary overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(bin.count / Math.max(results.length, 1)) * 100}%` }}
                    transition={{ duration: 0.6 }}
                    className={`h-full rounded-md ${bin.color}`}
                    style={{ minWidth: bin.count > 0 ? "4px" : "0" }}
                  />
                </div>
                <span className="text-muted w-4 text-right">{bin.count}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-surface rounded-lg p-5 border border-border">
        <h3 className="text-sm font-medium text-ink mb-3">Summary</h3>
        <div className="space-y-2 text-xs text-muted">
          {[
            { label: "Avg Experience", value: `${avgExp.toFixed(1)} years` },
            { label: "Total Results", value: String(results.length) },
            { label: "JD Length", value: `${jdText.length} chars` },
            { label: "Top Score", value: `${Math.round(results[0].scores.overall * 100)}%` },
          ].map((row) => (
            <div key={row.label} className="flex justify-between py-1">
              <span>{row.label}</span>
              <span className="font-medium text-ink/80">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
