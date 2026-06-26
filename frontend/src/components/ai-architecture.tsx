"use client"

import { motion } from "framer-motion"
import { Globe, Server, Cpu, Database, GitBranch, BarChart3 } from "lucide-react"

const nodes = [
  { icon: Globe, label: "Next.js"},
  { icon: Server, label: "Express API"},
  { icon: Cpu, label: "GPT-OSS-120B"},
  { icon: Database, label: "FastEmbed"},
  { icon: Database, label: "Qdrant"},
  { icon: GitBranch, label: "Hybrid Ranking"},
  { icon: BarChart3, label: "Results"},
]

export function AiArchitecture() {
  return (
    <section className="w-full py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          className="text-center mb-16"
        >
          <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
            AI <span className="text-primary">architecture</span>
          </h2>
          <p className="mt-3 text-sm text-muted-foreground max-w-lg mx-auto">
            Enterprise-grade stack powering intelligent candidate matching
          </p>
        </motion.div>

        <div className="relative overflow-hidden rounded-2xl bg-white border border-border p-8 md:p-12">
          <div className="hidden lg:flex items-center justify-center gap-0">
            {nodes.map((node, i) => (
              <div key={node.label} className="flex items-center">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="flex flex-col items-center gap-3"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/10">
                    <node.icon className="h-6 w-6 text-primary" />
                  </div>
                  <span className="text-xs font-medium text-foreground whitespace-nowrap">{node.label}</span>
                </motion.div>
                {i < nodes.length - 1 && (
                  <motion.div
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 + 0.3, duration: 0.4 }}
                    className="flex items-center mx-3"
                    style={{ transformOrigin: "left" }}
                  >
                    <div className="h-px w-12 bg-border" />
                    <div className="h-2 w-2 rotate-45 border-t border-r border-border -ml-1" />
                  </motion.div>
                )}
              </div>
            ))}
          </div>

          <div className="lg:hidden space-y-4">
            {nodes.map((node, i) => (
              <motion.div
                key={node.label}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="flex items-center gap-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/10">
                  <node.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium text-foreground">{node.label}</span>
                </div>
                {i < nodes.length - 1 && (
                  <div className="w-px h-4 bg-border mx-auto" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
