"use client"

import { motion } from "framer-motion"
import Link from "next/link"

export function LandingHero() {
  return (
    <section className="relative w-full overflow-hidden pt-20 pb-16 md:pt-28 md:pb-20">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] to-transparent pointer-events-none" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/[0.03] rounded-full blur-3xl pointer-events-none" />

      <div className="mx-auto max-w-5xl px-4 md:px-6 text-center relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1 text-xs text-muted-foreground shadow-sm mb-6">
            <span className="flex h-1.5 w-1.5 rounded-full bg-primary" />
            AI-Powered Recruitment Engine
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-[1.08] mb-5 max-w-4xl mx-auto">
            Discover top talent with{" "}
            <span className="text-primary">AI</span>
          </h1>

          <p className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed mb-8">
            Search, rank, and compare candidates with AI-powered semantic matching and explainable insights.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center h-10 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
            >
              Get Started
            </Link>
            <Link
              href="/#features"
              className="inline-flex items-center justify-center h-10 px-6 rounded-lg border border-border bg-background text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Learn More
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
