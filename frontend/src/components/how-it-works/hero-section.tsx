"use client"

import { motion } from "framer-motion"
import { ArrowDown } from "lucide-react"

export function HeroSection() {
  return (
    <section className="relative w-full pt-24 pb-16 md:pt-32 md:pb-20 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.02] to-transparent pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/[0.02] rounded-full blur-3xl pointer-events-none" />

      <div className="mx-auto max-w-4xl px-4 md:px-6 text-center relative">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1 text-xs text-muted-foreground shadow-sm mb-6">
            <span className="flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse-subtle" />
            AI-Powered Recruitment Intelligence
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-[1.08] mb-5">
            How RecruitIQ{" "}
            <span className="text-primary">Works</span>
          </h1>

          <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Discover how RecruitIQ combines semantic search, AI reasoning, vector databases and hybrid ranking
            to identify the best candidates—not just the best keyword matches.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-12"
        >
          <ArrowDown className="h-5 w-5 text-muted-foreground/40 mx-auto animate-bounce" />
        </motion.div>
      </div>
    </section>
  )
}
