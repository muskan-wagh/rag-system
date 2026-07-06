"use client"

import { motion } from "framer-motion"
import { ArrowDown, X, Check } from "lucide-react"

const problems = [
  "Keyword matching only",
  "Doesn't understand context",
  "Misses similar technologies",
  "Hidden ranking logic",
  "No explainability",
]

const benefits = [
  "Understands context",
  "Understands similar skills",
  "AI-powered reasoning",
  "Transparent scoring",
  "Better candidate discovery",
]

export function ProblemSection() {
  return (
    <section className="w-full py-16 md:py-24 bg-primary/[0.01]">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          className="text-center mb-16"
        >
          <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
            The <span className="text-primary">Problem</span>
          </h2>
          <p className="mt-3 text-sm text-muted-foreground max-w-lg mx-auto">
            Traditional ATS systems are built for keyword matching, not understanding candidates
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-start">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            className="bg-white rounded-2xl border border-border p-6 md:p-8"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
                <X className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Traditional ATS</h3>
                <p className="text-xs text-muted-foreground">Legacy keyword-based approach</p>
              </div>
            </div>

            <div className="space-y-1 mb-6">
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-muted/50">
                <span className="text-sm font-medium text-foreground/70">Resume</span>
              </div>
              <div className="flex justify-center py-1">
                <ArrowDown className="h-4 w-4 text-destructive/40" />
              </div>
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-muted/50">
                <span className="text-sm font-medium text-foreground/70">Keyword Search</span>
              </div>
              <div className="flex justify-center py-1">
                <ArrowDown className="h-4 w-4 text-destructive/40" />
              </div>
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-muted/50">
                <span className="text-sm font-medium text-foreground/70">Exact Match</span>
              </div>
              <div className="flex justify-center py-1">
                <ArrowDown className="h-4 w-4 text-destructive/40" />
              </div>
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-destructive/5 border border-destructive/10">
                <X className="h-4 w-4 text-destructive shrink-0" />
                <span className="text-sm font-medium text-destructive/80">Many Qualified Candidates Missed</span>
              </div>
            </div>

            <div className="space-y-2.5">
              <p className="text-xs font-medium text-destructive/60 uppercase tracking-wider mb-3">Problems</p>
              {problems.map((problem, i) => (
                <motion.div
                  key={problem}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-2.5"
                >
                  <X className="h-3.5 w-3.5 text-destructive/50 shrink-0" />
                  <span className="text-sm text-muted-foreground">{problem}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            className="bg-white rounded-2xl border border-primary/10 shadow-sm p-6 md:p-8"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-sm">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">RecruitIQ</h3>
                <p className="text-xs text-muted-foreground">AI-powered semantic matching</p>
              </div>
            </div>

            <div className="space-y-1 mb-6">
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary/5">
                <span className="text-sm font-medium text-foreground/70">Job Description</span>
              </div>
              <div className="flex justify-center py-1">
                <ArrowDown className="h-4 w-4 text-primary/40" />
              </div>
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary/5">
                <span className="text-sm font-medium text-foreground/70">AI Understanding</span>
              </div>
              <div className="flex justify-center py-1">
                <ArrowDown className="h-4 w-4 text-primary/40" />
              </div>
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary/5">
                <span className="text-sm font-medium text-foreground/70">Semantic Search</span>
              </div>
              <div className="flex justify-center py-1">
                <ArrowDown className="h-4 w-4 text-primary/40" />
              </div>
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary/5">
                <span className="text-sm font-medium text-foreground/70">Hybrid Ranking</span>
              </div>
              <div className="flex justify-center py-1">
                <ArrowDown className="h-4 w-4 text-primary/40" />
              </div>
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary/5 border border-primary/10">
                <Check className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-medium text-primary/80">Explainable Results</span>
              </div>
            </div>

            <div className="space-y-2.5">
              <p className="text-xs font-medium text-primary/60 uppercase tracking-wider mb-3">Benefits</p>
              {benefits.map((benefit, i) => (
                <motion.div
                  key={benefit}
                  initial={{ opacity: 0, x: 10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-2.5"
                >
                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-sm text-foreground/80">{benefit}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
