"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { ProgressBar } from "@/components/ui/progress-bar"
import { HelpCircle, CheckCircle } from "lucide-react"

const metrics = [
  { label: "Skill Match", value: 96, color: "bg-primary", desc: "Measures overlap between required skills and candidate skills. Accounts for similar and related technologies." },
  { label: "Experience", value: 91, color: "bg-chart-2", desc: "Evaluates years of experience, seniority level, and relevance of past roles to the position." },
  { label: "Education", value: 89, color: "bg-chart-4", desc: "Assesses degree level, field of study, and institutional relevance to the role requirements." },
  { label: "Semantic Match", value: 97, color: "bg-chart-5", desc: "Vector similarity between job description and candidate profile. Captures meaning beyond keywords." },
]

export function RankingBreakdown() {
  const [hoveredMetric, setHoveredMetric] = useState<string | null>(null)

  const activeMetric = metrics.find((m) => m.label === hoveredMetric)

  return (
    <section className="w-full py-16 md:py-24">
      <div className="mx-auto max-w-4xl px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
            Ranking <span className="text-primary">Breakdown</span>
          </h2>
          <p className="mt-3 text-sm text-muted-foreground max-w-lg mx-auto">
            Hover over each metric to understand how it contributes to the final score
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-white rounded-2xl border border-border p-6 md:p-8 shadow-sm"
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Overall Match</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-4xl font-semibold text-foreground">94</span>
                <span className="text-lg text-muted-foreground/60 font-medium">%</span>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-primary/5 px-3 py-1.5">
              <CheckCircle className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-primary">Confidence: High</span>
            </div>
          </div>

          <div className="space-y-2">
            {metrics.map((metric, i) => (
              <div
                key={metric.label}
                onMouseEnter={() => setHoveredMetric(metric.label)}
                onMouseLeave={() => setHoveredMetric(null)}
                className="group relative"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-muted-foreground">{metric.label}</span>
                  <HelpCircle className="h-3 w-3 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                </div>
                <ProgressBar
                  value={metric.value}
                  showValue={true}
                  color={metric.color}
                  delay={i * 0.15}
                  size="md"
                />
              </div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: hoveredMetric ? 1 : 0 }}
            className="mt-6 min-h-[60px]"
          >
            {activeMetric && (
              <div className="bg-primary/[0.03] rounded-xl border border-primary/10 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider">{activeMetric.label}</span>
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed">{activeMetric.desc}</p>
              </div>
            )}
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
