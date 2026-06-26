"use client"

import { motion } from "framer-motion"
import { Globe, Server, Brain, Search, Database, GitBranch, BarChart3, ArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"

const layers = [
  { icon: Globe, label: "Next.js Frontend", desc: "React-based UI with Tailwind CSS and Framer Motion" },
  { icon: Server, label: "Express Backend", desc: "REST API with TypeScript and middleware pipeline" },
  { icon: Brain, label: "GPT-OSS-120B", desc: "LLM for parsing JDs and generating explanations" },
  { icon: Search, label: "FastEmbed", desc: "Local embedding generation for semantic search" },
  { icon: Database, label: "Qdrant", desc: "Vector database for similarity search at scale" },
  { icon: GitBranch, label: "Hybrid Ranking", desc: "Multi-signal scoring: skills, experience, education" },
  { icon: BarChart3, label: "Candidate Results", desc: "Ranked candidates with explainable scores" },
]

export function ArchitectureSection() {
  return (
    <section className="w-full py-16 md:py-24 bg-primary/[0.01]">
      <div className="mx-auto max-w-5xl px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          className="text-center mb-14"
        >
          <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
            RecruitIQ <span className="text-primary">Architecture</span>
          </h2>
          <p className="mt-3 text-sm text-muted-foreground max-w-lg mx-auto">
            Enterprise-grade system design for intelligent candidate matching
          </p>
        </motion.div>

        <div className="hidden md:block">
          <div className="relative bg-white rounded-2xl border border-border p-8 md:p-10 shadow-sm overflow-hidden">
            <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-primary/10 to-transparent" />

            <div className="flex flex-col items-center gap-0">
              {layers.map((layer, i) => (
                <div key={layer.label} className="flex flex-col items-center">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 }}
                    className={cn(
                      "flex items-center gap-4 w-full max-w-sm p-4 rounded-xl border bg-white card-hover",
                      "hover:border-primary/20 hover:shadow-md"
                    )}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/10">
                      <layer.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-foreground">{layer.label}</span>
                      <p className="text-[11px] text-muted-foreground/70">{layer.desc}</p>
                    </div>
                  </motion.div>
                  {i < layers.length - 1 && (
                    <motion.div
                      initial={{ scaleY: 0 }}
                      whileInView={{ scaleY: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.08 + 0.2, duration: 0.3 }}
                      className="flex flex-col items-center py-1"
                      style={{ transformOrigin: "top" }}
                    >
                      <div className="h-4 w-px bg-gradient-to-b from-border to-border/30" />
                      <ArrowDown className="h-3.5 w-3.5 text-primary/30" />
                    </motion.div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="md:hidden space-y-3">
          {layers.map((layer, i) => (
            <motion.div
              key={layer.label}
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="flex items-center gap-3 p-3.5 bg-white rounded-xl border border-border"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <layer.icon className="h-4.5 w-4.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-foreground block">{layer.label}</span>
                <span className="text-xs text-muted-foreground/70 block truncate">{layer.desc}</span>
              </div>
              {i < layers.length - 1 && (
                <ArrowDown className="h-3.5 w-3.5 text-primary/20 shrink-0" />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
