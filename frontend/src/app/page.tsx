"use client"

import { motion } from "framer-motion"
import { HeroSearch } from "@/components/hero-search"
import { FeatureCard } from "@/components/feature-card"
import { AnalyticsSection } from "@/components/analytics-section"
import { Button } from "@/components/ui/button"
import { Brain, Search, BarChart3, Bot, ArrowRight } from "lucide-react"
import Link from "next/link"
import { ROUTES } from "@/lib/constants"

const features = [
  {
    icon: Brain,
    title: "Resume Intelligence",
    description: "AI extracts structured data from resumes — skills, experience, education — with 95%+ accuracy.",
    gradient: "from-purple-600 to-purple-400",
  },
  {
    icon: Search,
    title: "AI Candidate Search",
    description: "Semantic matching that understands context, synonyms, and seniority beyond keyword search.",
    gradient: "from-blue-600 to-blue-400",
  },
  {
    icon: BarChart3,
    title: "Candidate Ranking",
    description: "Multi-dimension scoring with explainable breakdowns across skills, experience, and education.",
    gradient: "from-cyan-600 to-cyan-400",
  },
  {
    icon: Bot,
    title: "Recruiter Copilot",
    description: "AI-powered insights, skill gap analysis, and smart recommendations for every role.",
    gradient: "from-purple-500 to-blue-500",
  },
]

export default function Home() {
  return (
    <div className="flex flex-col items-center">
      <section className="w-full pt-20 pb-12 md:pt-28 md:pb-16">
        <div className="container px-4 md:px-6 max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-center gap-5 text-center"
          >
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1 text-xs text-white/50">
              <span className="flex h-1.5 w-1.5 rounded-full bg-purple-500 animate-glow-pulse" />
              AI-Powered Recruitment Engine
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight max-w-4xl leading-[1.1]">
              Find the Right{" "}
              <span className="text-gradient">Candidate</span>
              <br />
              <span className="text-white/90">in Seconds</span>
            </h1>
            <p className="max-w-xl text-white/50 md:text-lg">
              AI-powered semantic search that understands job descriptions like a recruiter.
              Paste a JD and get ranked candidates with explainable scores instantly.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-10"
          >
            <HeroSearch />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-8 flex justify-center gap-6 text-sm"
          >
            {[
              { label: "Smart Ranking", desc: "Multi-dimension scoring" },
              { label: "AI Insights", desc: "Explainable results" },
              { label: "Fast & Accurate", desc: "Semantic matching" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-white/40">
                <div className="h-1 w-1 rounded-full bg-purple-500" />
                <span className="text-white/60 text-xs">{item.label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="w-full py-16 md:py-24">
        <div className="container px-4 md:px-6 max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl md:text-3xl font-semibold text-white mb-3">
              Everything you need to{" "}
              <span className="text-gradient">hire smarter</span>
            </h2>
            <p className="text-white/50 max-w-xl mx-auto text-sm">
              AI-powered tools that transform how you discover, evaluate, and rank candidates
            </p>
          </motion.div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, i) => (
              <FeatureCard key={feature.title} {...feature} index={i} />
            ))}
          </div>
        </div>
      </section>

      <AnalyticsSection />

      <section className="w-full py-16 md:py-24">
        <div className="container px-4 md:px-6 max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass rounded-2xl p-10 md:p-14 ring-1 ring-white/[0.06]"
          >
            <h2 className="text-2xl md:text-3xl font-semibold text-white mb-4">
              Ready to transform your hiring?
            </h2>
            <p className="text-white/50 mb-8 max-w-lg mx-auto text-sm">
              Start finding the best candidates in seconds with AI-powered matching.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href={ROUTES.candidates}>
                <Button className="bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-500 hover:to-blue-500 shadow-[0_0_30px_rgba(139,92,246,0.25)] h-10 px-6">
                  Start Searching <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href={ROUTES.compare}>
                <Button variant="ghost" className="text-white/60 hover:text-white h-10 px-6">
                  Try Comparison
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
