"use client"

import { motion } from "framer-motion"
import { Brain, Search, GitCompare, FileText, Shield, Zap, Sparkles, Clock, BarChart3 } from "lucide-react"
import { SectionHeader } from "@/components/ui/section-header"
import { GlassCard } from "@/components/ui/glass-card"

const features = [
  {
    icon: Brain,
    title: "Resume Intelligence",
    description: "AI extracts structured data from resumes with high accuracy — skills, experience, education, and more.",
    metric: "98% accuracy",
    metricIcon: Sparkles,
  },
  {
    icon: Zap,
    title: "Smart Ranking",
    description: "Hybrid ranking engine combines semantic similarity with weighted skill, experience, and education scores.",
    metric: "95% faster screening",
    metricIcon: Clock,
  },
  {
    icon: Search,
    title: "Semantic Search",
    description: "Find candidates by meaning, not keywords. Natural language understanding surfaces the best matches.",
    metric: "3x more matches",
    metricIcon: BarChart3,
  },
  {
    icon: GitCompare,
    title: "Side-by-Side Comparison",
    description: "Compare candidates head-to-head with AI-powered breakdowns of strengths, weaknesses, and fit.",
    metric: "10x faster decisions",
    metricIcon: Zap,
  },
  {
    icon: FileText,
    title: "One-Click Resume Dropbox",
    description: "Generate a unique application link. Candidates upload directly — no manual collection needed.",
    metric: "Zero manual work",
    metricIcon: Sparkles,
  },
  {
    icon: Shield,
    title: "Bias Detection",
    description: "AI scans job descriptions for biased language and suggests inclusive alternatives automatically.",
    metric: "Fair hiring guaranteed",
    metricIcon: Shield,
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const } },
}

export function FeaturesBento() {
  return (
    <section id="features" className="w-full py-20 md:py-28 relative overflow-hidden">
      <div className="absolute inset-0 noise-bg pointer-events-none opacity-20" />
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/[0.03] rounded-full blur-3xl" />

      <div className="mx-auto max-w-7xl px-4 md:px-8 relative">
        <SectionHeader
          label="Features"
          title="Everything you need to"
          highlight="hire smarter"
          description="AI-powered tools that transform how you discover, evaluate, and rank candidates"
        />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {features.map((feature) => (
            <motion.div key={feature.title} variants={cardVariants}>
              <GlassCard className="h-full flex flex-col">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-emerald-400/10 border border-primary/5 mb-5">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1">{feature.description}</p>
                <div className="mt-5 pt-4 border-t border-border/40 flex items-center gap-2">
                  <feature.metricIcon className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold text-primary">{feature.metric}</span>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
