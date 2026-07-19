"use client"

import { motion } from "framer-motion"
import { Upload, Brain, Search, GitCompare, Calendar, CheckCircle } from "lucide-react"
import { SectionHeader } from "@/components/ui/section-header"

const steps = [
  { icon: Upload, title: "Upload Resume", description: "Candidates submit resumes through a unique application link or direct upload." },
  { icon: Brain, title: "AI Parsing", description: "Advanced LLM extracts structured data — skills, experience, and education." },
  { icon: Search, title: "Semantic Ranking", description: "Vector search finds semantically similar candidates at scale." },
  { icon: GitCompare, title: "Candidate Comparison", description: "AI-powered head-to-head analysis with score breakdowns." },
  { icon: Calendar, title: "Interview Scheduling", description: "Seamless scheduling with calendar integration and reminders." },
  { icon: CheckCircle, title: "Hiring", description: "Confident decisions backed by explainable AI insights." },
]

export function WorkflowSection() {
  return (
    <section id="how-it-works" className="w-full py-20 md:py-28 relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 md:px-8 relative">
        <SectionHeader
          label="Workflow"
          title="From resume to hire"
          highlight="in minutes"
          description="A streamlined pipeline powered by AI at every step"
        />

        <div className="relative max-w-4xl mx-auto">
          <div className="absolute left-1/2 -translate-x-px top-0 bottom-0 w-px bg-border hidden md:block" />

          <div className="space-y-8 md:space-y-0 relative">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: i * 0.1 }}
                className="relative md:flex md:items-center md:gap-8 md:py-6"
              >
                <div className="hidden md:flex md:w-1/2 justify-end">
                  {i % 2 === 0 && (
                    <div className="text-right pr-8">
                      <h3 className="text-[15px] font-medium text-ink mb-1" style={{ fontFamily: "var(--font-inter)" }}>{step.title}</h3>
                      <p className="text-sm text-muted max-w-xs ml-auto" style={{ fontFamily: "var(--font-inter)" }}>{step.description}</p>
                    </div>
                  )}
                </div>

                <div className="hidden md:flex flex-col items-center relative z-10">
                  <div className="w-11 h-11 rounded-[10px] bg-info flex items-center justify-center">
                    <step.icon className="h-5 w-5 text-white" />
                  </div>
                  {i < steps.length - 1 && (
                    <div className="w-px h-8 bg-border" />
                  )}
                </div>

                <div className="hidden md:flex md:w-1/2">
                  {i % 2 === 1 && (
                    <div className="text-left pl-8">
                      <h3 className="text-[15px] font-medium text-ink mb-1" style={{ fontFamily: "var(--font-inter)" }}>{step.title}</h3>
                      <p className="text-sm text-muted max-w-xs" style={{ fontFamily: "var(--font-inter)" }}>{step.description}</p>
                    </div>
                  )}
                </div>

                <div className="md:hidden flex items-start gap-4">
                  <div className="w-10 h-10 rounded-[10px] bg-info flex items-center justify-center shrink-0">
                    <step.icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-ink mb-0.5" style={{ fontFamily: "var(--font-inter)" }}>{step.title}</h3>
                    <p className="text-sm text-muted" style={{ fontFamily: "var(--font-inter)" }}>{step.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
