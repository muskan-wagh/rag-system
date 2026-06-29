"use client"

import { motion } from "framer-motion"
import { X, Check, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

const comparisons = [
  { traditional: "Keyword Matching", recruit: "Semantic Search", highlight: true },
  { traditional: "Boolean Search", recruit: "Vector Embeddings", highlight: true },
  { traditional: "Manual Screening", recruit: "AI Ranking", highlight: true },
  { traditional: "No AI", recruit: "Explainable Decisions", highlight: true },
  { traditional: "Static Filters", recruit: "Hybrid Scoring", highlight: true },
  { traditional: "Hidden Ranking", recruit: "Natural Language Search", highlight: true },
]

export function WhyBetterTable() {
  return (
    <section className="w-full py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
            Why RecruitFlow is <span className="text-primary">Better</span>
          </h2>
          <p className="mt-3 text-sm text-muted-foreground max-w-lg mx-auto">
            Traditional systems were built for the resume era. RecruitFlow is built for the intelligence era.
          </p>
        </motion.div>

        <div className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="grid grid-cols-3 gap-0">
            <div className="px-5 py-4 bg-muted/50 border-r border-border">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Feature</span>
            </div>
            <div className="px-5 py-4 bg-destructive/[0.03] border-r border-border">
              <span className="text-xs font-semibold text-destructive/70 uppercase tracking-wider">Traditional ATS</span>
            </div>
            <div className="px-5 py-4 bg-primary/[0.03]">
              <span className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                RecruitFlow
              </span>
            </div>
          </div>

          <div className="divide-y divide-border">
            {comparisons.map((item, i) => (
              <motion.div
                key={item.traditional}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="grid grid-cols-3 gap-0"
              >
                <div className="px-5 py-3.5 flex items-center border-r border-border">
                  <span className="text-sm text-muted-foreground">{item.traditional}</span>
                </div>
                <div className="px-5 py-3.5 flex items-center gap-2.5 border-r border-border bg-destructive/[0.02]">
                  <X className="h-3.5 w-3.5 text-destructive/40 shrink-0" />
                  <span className="text-sm text-muted-foreground/70 line-through">{item.traditional}</span>
                </div>
                <div className={cn(
                  "px-5 py-3.5 flex items-center gap-2.5",
                  item.highlight ? "bg-primary/[0.02]" : ""
                )}>
                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-sm font-medium text-foreground">{item.recruit}</span>
                  {item.highlight && (
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary ml-auto">
                      Better
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
