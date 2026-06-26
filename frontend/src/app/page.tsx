"use client"

import { motion } from "framer-motion"
import { HeroSearch } from "@/components/hero-search"
import { FeatureCard } from "@/components/feature-card"
import { HowItWorks } from "@/components/how-it-works"
import { AiArchitecture } from "@/components/ai-architecture"
import { Button } from "@/components/ui/button"
import { Brain, Search, BarChart3, Bot, ArrowRight } from "lucide-react"
import Link from "next/link"
import { ROUTES } from "@/lib/constants"

const features = [
  {
    icon: Brain,
    title: "Resume Intelligence",
    description: "AI extracts structured data from resumes with 95%+ accuracy — skills, experience, education.",
    benefits: [
      "Automatic skill extraction and categorization",
      "Experience timeline reconstruction",
      "Education and certification parsing",
    ],

  },
]

export default function Home() {
  return (
    <div className="flex flex-col items-center">
      <section className="w-full pt-16 pb-8 md:pt-20 md:pb-10">
        <div className="mx-auto max-w-5xl px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center gap-4 text-center"
          >
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1 text-xs text-muted-foreground shadow-sm">
              <span className="flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse-subtle" />
              AI-Powered Recruitment Engine
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight max-w-3xl leading-[1.08]">
              Discover top talent with{" "}
              <span className="text-primary">AI</span>
            </h1>
            <p className="max-w-lg text-sm text-muted-foreground">
              Search, rank, and compare candidates with AI-powered semantic matching and explainable insights.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-8"
          >
            <HeroSearch />
          </motion.div>
        </div>
      </section>

      <section className="w-full py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
              Everything you need to{" "}
              <span className="text-primary">hire smarter</span>
            </h2>
            <p className="mt-3 text-sm text-muted-foreground max-w-lg mx-auto">
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

      <HowItWorks />
      <AiArchitecture />

      <section className="w-full py-16 md:py-24">
        <div className="mx-auto max-w-3xl px-4 md:px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white rounded-2xl p-10 md:p-14 border border-border shadow-sm"
          >
            <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-3">
              Ready to transform your hiring?
            </h2>
            <p className="text-sm text-muted-foreground mb-8 max-w-md mx-auto">
              Start finding the best candidates in seconds with AI-powered matching.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href={ROUTES.candidates}>
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm h-10 px-6">
                  Start Searching <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href={ROUTES.compare}>
                <Button variant="outline" className="text-muted-foreground hover:text-foreground h-10 px-6">
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
