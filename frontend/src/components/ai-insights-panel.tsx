"use client"

import { motion } from "framer-motion"
import { Lightbulb, Target, TrendingUp, Award, Users, Brain } from "lucide-react"
import { ProgressBar } from "@/components/ui/progress-bar"
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
      <div className="bg-white rounded-2xl p-5 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Lightbulb className="h-3.5 w-3.5 text-primary" />
          </div>
          <h3 className="text-sm font-medium text-foreground">AI Insights</h3>
        </div>
        <div className="space-y-3 text-xs">
          <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-primary/[0.02]">
            <Award className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
            <p className="text-muted-foreground">
              Top match: <span className="font-medium text-foreground">{topName}</span> at{" "}
              {Math.round(results[0].scores.overall * 100)}% fit
            </p>
          </div>
          <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-accent/[0.02]">
            <TrendingUp className="h-3.5 w-3.5 text-accent mt-0.5 shrink-0" />
            <p className="text-muted-foreground">
              Average match: <span className="font-medium text-foreground">{Math.round(avgScore * 100)}%</span> across {results.length} candidates
            </p>
          </div>
          <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-chart-3/[0.02]">
            <Users className="h-3.5 w-3.5 text-chart-3 mt-0.5 shrink-0" />
            <p className="text-muted-foreground">
              Avg experience: <span className="font-medium text-foreground">{avgExp.toFixed(1)} years</span>
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">Top Skills</h3>
        </div>
        <div className="space-y-2.5">
          {commonSkills.map(([skill, count]) => (
            <div key={skill} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground w-24 truncate">{skill}</span>
              <div className="flex-1 mx-3">
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(count / maxSkillCount) * 100}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full rounded-full bg-primary"
                  />
                </div>
              </div>
              <span className="text-muted-foreground w-4 text-right font-medium">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 border border-border">
        <h3 className="text-sm font-medium text-foreground mb-4">Score Distribution</h3>
        <div className="space-y-3">
          {[
            { label: "0-40%", count: results.filter(r => r.scores.overall < 0.4).length, color: "bg-muted-foreground/30" },
            { label: "40-60%", count: results.filter(r => r.scores.overall >= 0.4 && r.scores.overall < 0.6).length, color: "bg-chart-3/50" },
            { label: "60-80%", count: results.filter(r => r.scores.overall >= 0.6 && r.scores.overall < 0.8).length, color: "bg-accent/50" },
            { label: "80-100%", count: results.filter(r => r.scores.overall >= 0.8).length, color: "bg-primary/50" },
          ].map((bin) => {
            const maxBinCount = Math.max(...results.length > 0 ? [1] : [])
            return (
              <div key={bin.label} className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground w-12">{bin.label}</span>
                <div className="flex-1 h-5 rounded-md bg-muted overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(bin.count / Math.max(results.length, 1)) * 100}%` }}
                    transition={{ duration: 0.6 }}
                    className={`h-full rounded-md ${bin.color}`}
                    style={{ minWidth: bin.count > 0 ? "4px" : "0" }}
                  />
                </div>
                <span className="text-muted-foreground w-4 text-right">{bin.count}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 border border-border">
        <h3 className="text-sm font-medium text-foreground mb-3">Summary</h3>
        <div className="space-y-2 text-xs text-muted-foreground">
          {[
            { label: "Avg Experience", value: `${avgExp.toFixed(1)} years` },
            { label: "Total Results", value: String(results.length) },
            { label: "JD Length", value: `${jdText.length} chars` },
            { label: "Top Score", value: `${Math.round(results[0].scores.overall * 100)}%` },
          ].map((row) => (
            <div key={row.label} className="flex justify-between py-1">
              <span>{row.label}</span>
              <span className="font-medium text-foreground/80">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
