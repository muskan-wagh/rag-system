"use client"

import { motion } from "framer-motion"
import { Brain, Search, GitCompare, Shield, BarChart3, Sparkles } from "lucide-react"
import { SectionHeader } from "@/components/ui/section-header"

const blocks = [
  {
    icon: Brain,
    title: "AI-Powered Resume Parsing",
    description: "Our advanced LLM extracts structured data from any resume format — PDF, DOCX, or plain text. Skills, experience, education, and certifications are parsed with industry-leading accuracy.",
    stat: "98%",
    statLabel: "Parsing accuracy",
    gradient: "from-primary to-accent",
    image: (
      <div className="glass-strong rounded-2xl p-6 border border-white/50 shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-primary/30" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resume Parsed</span>
        </div>
        <div className="space-y-3">
          {[
            { label: "Name", value: "Sarah Kim" },
            { label: "Skills", value: "React, TypeScript, Node.js, Python" },
            { label: "Experience", value: "6 years · Senior Frontend Engineer" },
            { label: "Education", value: "B.S. Computer Science, MIT" },
            { label: "Certifications", value: "AWS Solutions Architect" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="text-xs font-medium text-muted-foreground w-20">{item.label}</span>
              <div className="h-2 flex-1 bg-white/50 rounded-full overflow-hidden">
                <div className="h-full w-full bg-primary/10 rounded-full" />
              </div>
              <span className="text-xs font-medium text-foreground">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    icon: Search,
    title: "Semantic Candidate Search",
    description: "Find candidates by meaning, not keywords. Our vector search engine understands context, synonyms, and relationships to surface the best matches for any role.",
    stat: "3x",
    statLabel: "More relevant matches",
    gradient: "from-blue-500 to-indigo-400",
    image: (
      <div className="glass-strong rounded-2xl p-6 border border-white/50 shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-blue-400" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Semantic Search</span>
        </div>
        <div className="space-y-2">
          {[
            { query: "Senior React developer with system design experience", match: "92%" },
            { query: "Frontend engineer who knows TypeScript and GraphQL", match: "88%" },
            { query: "Engineering manager with agile background", match: "85%" },
          ].map((item, i) => (
            <div key={i} className="bg-white/40 rounded-lg p-2.5 border border-white/30">
              <p className="text-xs text-foreground mb-1 line-clamp-1">{item.query}</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 bg-white/60 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-400 rounded-full" style={{ width: item.match }} />
                </div>
                <span className="text-[10px] font-bold text-blue-500">{item.match}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    icon: BarChart3,
    title: "Intelligent Ranking Engine",
    description: "Our hybrid ranking combines semantic similarity with weighted scoring across skills, experience, education, and cultural fit — all customizable to your priorities.",
    stat: "95%",
    statLabel: "Faster screening",
    gradient: "from-amber-500 to-orange-400",
    image: (
      <div className="glass-strong rounded-2xl p-6 border border-white/50 shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ranking Breakdown</span>
        </div>
        <div className="space-y-2.5">
          {[
            { label: "Skills Match", value: 94, color: "from-primary to-accent" },
            { label: "Experience", value: 88, color: "from-blue-500 to-indigo-400" },
            { label: "Education", value: 82, color: "from-amber-500 to-orange-400" },
            { label: "Cultural Fit", value: 76, color: "from-violet-500 to-purple-400" },
          ].map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <span className="text-xs font-bold text-foreground">{item.value}%</span>
              </div>
              <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                <div className={`h-full bg-gradient-to-r ${item.color} rounded-full`} style={{ width: `${item.value}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
]

export function WhyRecruitIQ() {
  return (
    <section className="w-full py-20 md:py-28 relative overflow-hidden">
      <div className="absolute inset-0 noise-bg pointer-events-none opacity-20" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-primary/30/[0.03] rounded-full blur-3xl" />

      <div className="mx-auto max-w-7xl px-4 md:px-8 relative">
        <SectionHeader
          label="Why RecruitIQ"
          title="Built for modern"
          highlight="hiring teams"
          description="Purpose-built AI tools that transform every stage of your recruitment workflow"
        />

        <div className="space-y-20 md:space-y-28">
          {blocks.map((block, i) => (
            <motion.div
              key={block.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6 }}
              className={`grid md:grid-cols-2 gap-8 md:gap-16 items-center ${i % 2 === 1 ? "md:direction-rtl" : ""}`}
            >
              <div className={i % 2 === 1 ? "md:order-2" : ""}>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/5 border border-primary/5 mb-5">
                  <block.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground mb-4">
                  {block.title}
                </h3>
                <p className="text-base text-muted-foreground leading-relaxed mb-6 max-w-lg">
                  {block.description}
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold text-gradient bg-gradient-to-r bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(to right, var(--primary), var(--accent))` }}>
                    {block.stat}
                  </span>
                  <span className="text-sm text-muted-foreground">{block.statLabel}</span>
                </div>
              </div>
              <motion.div
                initial={{ opacity: 0, x: i % 2 === 0 ? 30 : -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className={i % 2 === 1 ? "md:order-1" : ""}
              >
                {block.image}
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
