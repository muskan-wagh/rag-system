"use client"

import { motion } from "framer-motion"
import { Brain, Search, GitCompare, FileText, Shield, Zap } from "lucide-react"

const features = [
  {
    icon: Brain,
    title: "Resume Intelligence",
    description: "AI extracts structured data from resumes with high accuracy — skills, experience, education, and more.",
    span: "col-span-1",
  },
  {
    icon: Zap,
    title: "Smart Ranking",
    description: "Hybrid ranking engine combines semantic similarity with weighted skill, experience, and education scores.",
    span: "col-span-1",
  },
  {
    icon: Search,
    title: "Semantic Search",
    description: "Find candidates by meaning, not keywords. Natural language understanding surfaces the best matches.",
    span: "col-span-1 md:col-span-2",
  },
  {
    icon: GitCompare,
    title: "Side-by-Side Comparison",
    description: "Compare candidates head-to-head with AI-powered breakdowns of strengths, weaknesses, and fit.",
    span: "col-span-1",
  },
  {
    icon: FileText,
    title: "One-Click Resume Dropbox",
    description: "Generate a unique application link. Candidates upload directly — no manual collection needed.",
    span: "col-span-1",
  },
  {
    icon: Shield,
    title: "Bias Detection",
    description: "AI scans job descriptions for biased language and suggests inclusive alternatives.",
    span: "col-span-1",
  },
]

export function FeaturesBento() {
  return (
    <section id="features" className="w-full py-16 md:py-24">
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.06 }}
              className={`${feature.span} bg-white rounded-xl border border-border p-6 hover:border-primary/20 transition-colors`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 mb-4">
                <feature.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
