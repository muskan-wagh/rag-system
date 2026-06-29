"use client"

import { motion } from "framer-motion"
import { Search, Brain, BarChart3, GitBranch, GitCompare, Lightbulb, ArrowRight } from "lucide-react"

const cards = [
  {
    icon: Search,
    title: "Semantic Search",
    description: "Search by meaning, not keywords. Find candidates who match the intent of your job description.",
    benefit: "Discover qualified candidates you would otherwise miss",
  },
  {
    icon: Brain,
    title: "AI Resume Understanding",
    description: "GPT-OSS-120B automatically extracts skills, experience, and education from resumes.",
    benefit: "Eliminate manual data entry and parsing errors",
  },
  {
    icon: BarChart3,
    title: "Explainable AI",
    description: "Every ranking includes a plain-language explanation of why each candidate was scored.",
    benefit: "Build trust with transparent, auditable decisions",
  },
  {
    icon: GitBranch,
    title: "Hybrid Ranking",
    description: "Combines semantic similarity with weighted skill, experience, and education scoring.",
    benefit: "Prioritize what matters most for each role",
  },
  {
    icon: GitCompare,
    title: "Candidate Comparison",
    description: "Side-by-side comparison with AI-generated insights highlighting key differences.",
    benefit: "Make faster, more informed hiring decisions",
  },
  {
    icon: Lightbulb,
    title: "Recruiter Insights",
    description: "AI suggests skills gaps, experience mismatches, and hidden strengths for each candidate.",
    benefit: "Go beyond the resume with actionable intelligence",
  },
]

export function WinningCards() {
  return (
    <section className="w-full py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
            Why RecruitFlow <span className="text-primary">Wins</span>
          </h2>
          <p className="mt-3 text-sm text-muted-foreground max-w-lg mx-auto">
            Six capabilities that set RecruitFlow apart from traditional ATS systems
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {cards.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.06 }}
              whileHover={{ y: -6 }}
              className="group card-hover"
            >
              <div className="relative bg-white rounded-2xl border border-border p-6 h-full flex flex-col">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary shadow-sm group-hover:shadow-md transition-shadow">
                  <card.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">{card.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">{card.description}</p>
                <div className="pt-4 border-t border-border">
                  <p className="text-xs text-primary/70 font-medium flex items-center gap-1.5">
                    <span className="flex h-1.5 w-1.5 rounded-full bg-primary/40" />
                    {card.benefit}
                  </p>
                </div>
                <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRight className="h-4 w-4 text-primary/30" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
