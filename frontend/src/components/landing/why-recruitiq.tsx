"use client"

import { motion } from "framer-motion"
import { Brain, Search, BarChart3 } from "lucide-react"
import { SectionHeader } from "@/components/ui/section-header"

const blocks = [
  {
    icon: Brain,
    title: "AI-Powered Resume Parsing",
    description: "Our advanced LLM extracts structured data from any resume format — PDF, DOCX, or plain text. Skills, experience, education, and certifications are parsed with industry-leading accuracy.",
    stat: "98%",
    statLabel: "Parsing accuracy",
  },
  {
    icon: Search,
    title: "Semantic Candidate Search",
    description: "Find candidates by meaning, not keywords. Our vector search engine understands context, synonyms, and relationships to surface the best matches for any role.",
    stat: "3x",
    statLabel: "More relevant matches",
  },
  {
    icon: BarChart3,
    title: "Intelligent Ranking Engine",
    description: "Our hybrid ranking combines semantic similarity with weighted scoring across skills, experience, education, and cultural fit — all customizable to your priorities.",
    stat: "95%",
    statLabel: "Faster screening",
  },
]

export function WhyRecruitIQ() {
  return (
    <section className="w-full py-20 md:py-28 relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 md:px-8 relative">
        <SectionHeader
          label="Why RecruitIQ"
          title="Built for modern"
          highlight="hiring teams"
          description="Purpose-built AI tools that transform every stage of your recruitment workflow"
        />

        <div className="space-y-12 md:space-y-16">
          {blocks.map((block, i) => (
            <motion.div
              key={block.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6 }}
              className={`grid md:grid-cols-2 gap-8 md:gap-16 items-center`}
            >
              <div className={i % 2 === 1 ? "md:order-2" : ""}>
                <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-info mb-5">
                  <block.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-2xl md:text-3xl font-medium text-ink mb-4" style={{ fontFamily: "var(--font-inter)", letterSpacing: "-0.01em" }}>
                  {block.title}
                </h3>
                <p className="text-base text-muted leading-relaxed mb-6 max-w-lg" style={{ fontFamily: "var(--font-inter)" }}>
                  {block.description}
                </p>
                <div className="flex items-center gap-3">
                  <span className="font-data text-3xl font-medium text-ink">{block.stat}</span>
                  <span className="text-sm text-muted" style={{ fontFamily: "var(--font-inter)" }}>{block.statLabel}</span>
                </div>
              </div>
              <motion.div
                initial={{ opacity: 0, x: i % 2 === 0 ? 30 : -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className={i % 2 === 1 ? "md:order-1" : ""}
              >
                <div className="rounded-xl border border-border bg-surface p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-ink" />
                    <span className="text-xs font-medium text-muted uppercase" style={{ letterSpacing: "0.04em", fontFamily: "var(--font-inter)" }}>
                      {block.title}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {block.title === "AI-Powered Resume Parsing" && (
                      <>
                        {[
                          { label: "Name", value: "Sarah Kim" },
                          { label: "Skills", value: "React, TypeScript, Node.js, Python" },
                          { label: "Experience", value: "6 years · Senior Frontend Engineer" },
                          { label: "Education", value: "B.S. Computer Science, MIT" },
                        ].map((item) => (
                          <div key={item.label} className="flex items-center gap-3">
                            <span className="text-xs font-medium text-muted w-20 shrink-0" style={{ fontFamily: "var(--font-inter)" }}>{item.label}</span>
                            <div className="h-2 flex-1 bg-[#FAFAFA] rounded-full overflow-hidden">
                              <div className="h-full w-full bg-[#F3F4F6] rounded-full" />
                            </div>
                            <span className="text-xs font-medium text-ink" style={{ fontFamily: "var(--font-inter)" }}>{item.value}</span>
                          </div>
                        ))}
                      </>
                    )}
                    {block.title === "Semantic Candidate Search" && (
                      <>
                        {[
                          { query: "Senior React developer with system design experience", match: "92%" },
                          { query: "Frontend engineer who knows TypeScript and GraphQL", match: "88%" },
                          { query: "Engineering manager with agile background", match: "85%" },
                        ].map((item, i) => (
                          <div key={i} className="bg-[#FAFAFA] rounded-lg p-3 border border-border">
                            <p className="text-xs text-ink mb-1 line-clamp-1" style={{ fontFamily: "var(--font-inter)" }}>{item.query}</p>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
                                <div className="h-full bg-info rounded-full" style={{ width: item.match }} />
                              </div>
                              <span className="font-data text-[10px] font-medium text-ink">{item.match}</span>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                    {block.title === "Intelligent Ranking Engine" && (
                      <>
                        {[
                          { label: "Skills Match", value: 94 },
                          { label: "Experience", value: 88 },
                          { label: "Education", value: 82 },
                          { label: "Cultural Fit", value: 76 },
                        ].map((item) => (
                          <div key={item.label}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-muted" style={{ fontFamily: "var(--font-inter)" }}>{item.label}</span>
                              <span className="font-data text-xs font-medium text-ink">{item.value}%</span>
                            </div>
                            <div className="h-1.5 bg-[#FAFAFA] rounded-full overflow-hidden">
                              <div className="h-full bg-info rounded-full" style={{ width: `${item.value}%` }} />
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
