"use client"

import { motion } from "framer-motion"
import { FileText, Brain, Search, BarChart3, GitCompare, Target, Sparkles, ArrowDown } from "lucide-react"

const steps = [
  { icon: FileText, title: "Job Description", description: "Paste a job description or describe your ideal candidate in natural language." },
  { icon: Brain, title: "AI Parser", description: "GPT-OSS-120B extracts skills, experience requirements, and responsibilities." },
  { icon: Search, title: "FastEmbed", description: "Converts parsed requirements into high-dimensional semantic vectors." },
  { icon: BarChart3, title: "Qdrant Semantic Search", description: "Vector database finds semantically similar candidates at scale." },
  { icon: GitCompare, title: "Hybrid Ranking Engine", description: "Combines semantic similarity with weighted skill, experience, and education scores." },
  { icon: Target, title: "GPT-OSS-120B", description: "Large language model generates explainable rankings and hiring insights." },
  { icon: Sparkles, title: "Candidate Rankings", description: "Browse ranked candidates with detailed score breakdowns and AI explanations." },
]

export function HowItWorks() {
  return (
    <section className="w-full py-20 md:py-28 bg-primary/[0.01]">
      <div className="mx-auto max-w-4xl px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          className="text-center mb-16"
        >
          <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
            How it <span className="text-primary">works</span>
          </h2>
          <p className="mt-3 text-sm text-muted-foreground max-w-lg mx-auto">
            From job description to ranked candidates in seconds
          </p>
        </motion.div>

        <div className="relative">
          <div className="absolute left-8 top-0 bottom-0 w-px bg-border hidden md:block" />

          <div className="space-y-8 md:space-y-0">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: i * 0.08 }}
                className="relative md:flex md:items-start md:gap-8 md:pb-8"
              >
                <div className="hidden md:flex flex-col items-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/10 relative z-10">
                    <step.icon className="h-6 w-6 text-primary" />
                  </div>
                  {i < steps.length - 1 && (
                    <div className="flex-1 flex items-center justify-center py-2">
                      <ArrowDown className="h-4 w-4 text-primary/20" />
                    </div>
                  )}
                </div>

                <div className="md:hidden flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/10">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                  {i < steps.length - 1 && (
                    <div className="absolute left-6 top-12 bottom-0 w-px bg-border" />
                  )}
                </div>

                <div className="flex-1 md:pt-3 ml-16 md:ml-0">
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 px-2.5 py-0.5 text-[10px] font-medium text-primary mb-2">
                    Step {i + 1}
                  </div>
                  <h3 className="text-base font-medium text-foreground mb-1">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
