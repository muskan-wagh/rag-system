"use client"

import { motion } from "framer-motion"
import { Lightbulb, Target, TrendingUp } from "lucide-react"
import type { RankingResult } from "@/lib/api"

interface AiInsightsPanelProps {
  results: RankingResult[]
  jdText: string
}

export function AiInsightsPanel({ results, jdText }: AiInsightsPanelProps) {
  if (results.length === 0) return null

  const avgScore = results.reduce((sum, r) => sum + r.scores.overall, 0) / results.length
  const topSkills = new Map<string, number>()
  results.forEach((r) => {
    r.candidate.skills.forEach((s) => topSkills.set(s, (topSkills.get(s) || 0) + 1))
  })
  const commonSkills = [...topSkills.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const avgExp = results.reduce((sum, r) => sum + r.candidate.experience, 0) / results.length
  const topName = results[0].candidate.name

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-4"
    >
      <div className="glass rounded-2xl p-5 ring-1 ring-white/[0.06]">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="h-4 w-4 text-purple-400" />
          <h3 className="text-sm font-medium text-white">AI Insights</h3>
        </div>
        <div className="space-y-3 text-xs text-white/50">
          <div className="flex items-start gap-2">
            <Target className="h-3.5 w-3.5 text-purple-400 mt-0.5 shrink-0" />
            <p>
              Top match is <span className="text-white/80">{topName}</span> with{" "}
              {Math.round(results[0].scores.overall * 100)}% overall fit
            </p>
          </div>
          <div className="flex items-start gap-2">
            <TrendingUp className="h-3.5 w-3.5 text-blue-400 mt-0.5 shrink-0" />
            <p>
              Average match score across {results.length} candidates:{" "}
              <span className="text-white/80">{Math.round(avgScore * 100)}%</span>
            </p>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-5 ring-1 ring-white/[0.06]">
        <h3 className="text-sm font-medium text-white mb-3">Top Skills</h3>
        <div className="space-y-2">
          {commonSkills.map(([skill, count]) => (
            <div key={skill} className="flex items-center justify-between text-xs">
              <span className="text-white/60">{skill}</span>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-20 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500"
                    style={{ width: `${(count / results.length) * 100}%` }}
                  />
                </div>
                <span className="text-white/40 w-4 text-right">{count}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass rounded-2xl p-5 ring-1 ring-white/[0.06]">
        <h3 className="text-sm font-medium text-white mb-3">Summary</h3>
        <div className="space-y-2 text-xs text-white/50">
          <div className="flex justify-between">
            <span>Avg Experience</span>
            <span className="text-white/80">{avgExp.toFixed(1)} years</span>
          </div>
          <div className="flex justify-between">
            <span>Total Results</span>
            <span className="text-white/80">{results.length}</span>
          </div>
          <div className="flex justify-between">
            <span>JD Length</span>
            <span className="text-white/80">{jdText.length} chars</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
