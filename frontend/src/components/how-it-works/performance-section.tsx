"use client"

import { motion } from "framer-motion"
import { Users, Zap, Brain, BarChart3, Cpu, Smartphone } from "lucide-react"

const metrics = [
  { icon: Users, label: "Thousands of Candidate Profiles", desc: "Scales to enterprise datasets without performance degradation" },
  { icon: Zap, label: "Millisecond Semantic Search", desc: "Qdrant vector search returns results in milliseconds" },
  { icon: Brain, label: "AI-Powered Ranking", desc: "GPT-OSS-120B generates intelligent rankings and insights" },
  { icon: BarChart3, label: "Explainable Results", desc: "Every score comes with a plain-language explanation" },
  { icon: Cpu, label: "Modern Architecture", desc: "TypeScript, Next.js 16, and modular service design" },
  { icon: Smartphone, label: "Responsive UI", desc: "Works seamlessly across desktop, tablet, and mobile" },
]

export function PerformanceSection() {
  return (
    <section className="w-full py-16 md:py-24 bg-primary/[0.01]">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
            Performance &{" "}
            <span className="text-primary">Capabilities</span>
          </h2>
          <p className="mt-3 text-sm text-muted-foreground max-w-lg mx-auto">
            Built for speed, scale, and reliability
          </p>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {metrics.map((metric, i) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="bg-white rounded-xl border border-border p-4 md:p-5 text-center card-hover hover:border-primary/20 hover:shadow-sm"
            >
              <div className="flex justify-center mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <metric.icon className="h-4.5 w-4.5 text-primary" />
                </div>
              </div>
              <h3 className="text-xs md:text-sm font-semibold text-foreground mb-1 leading-snug">{metric.label}</h3>
              <p className="text-[11px] md:text-xs text-muted-foreground leading-relaxed">{metric.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
