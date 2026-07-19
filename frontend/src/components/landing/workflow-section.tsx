"use client"

import { motion } from "framer-motion"
import { Upload, Brain, Search, GitCompare, Calendar, CheckCircle } from "lucide-react"
import { SectionHeader } from "@/components/ui/section-header"

const steps = [
  { icon: Upload, title: "Upload Resume", description: "Candidates submit resumes through a unique application link or direct upload.", color: "from-primary to-accent" },
  { icon: Brain, title: "AI Parsing", description: "Advanced LLM extracts structured data — skills, experience, and education.", color: "from-[#170C2B] to-[#170C2B]/80" },
  { icon: Search, title: "Semantic Ranking", description: "Vector search finds semantically similar candidates at scale.", color: "from-amber-500 to-orange-400" },
  { icon: GitCompare, title: "Candidate Comparison", description: "AI-powered head-to-head analysis with score breakdowns.", color: "from-violet-500 to-purple-400" },
  { icon: Calendar, title: "Interview Scheduling", description: "Seamless scheduling with calendar integration and reminders.", color: "from-success to-accent" },
  { icon: CheckCircle, title: "Hiring", description: "Confident decisions backed by explainable AI insights.", color: "from-primary to-accent" },
]

export function WorkflowSection() {
  return (
    <section id="how-it-works" className="w-full py-20 md:py-28 relative overflow-hidden">
      <div className="absolute inset-0 grid-bg pointer-events-none opacity-30" />
      <div className="absolute inset-0 noise-bg pointer-events-none opacity-20" />
      <div className="absolute top-1/3 left-0 w-[400px] h-[400px] bg-primary/[0.03] rounded-full blur-3xl" />

      <div className="mx-auto max-w-7xl px-4 md:px-8 relative">
        <SectionHeader
          label="Workflow"
          title="From resume to hire"
          highlight="in minutes"
          description="A streamlined pipeline powered by AI at every step"
        />

        <div className="relative max-w-4xl mx-auto">
          <div className="absolute left-1/2 -translate-x-px top-0 bottom-0 w-px bg-gradient-to-b from-primary/20 via-primary/10 to-transparent hidden md:block" />

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
                      <h3 className="text-base font-semibold text-foreground mb-1">{step.title}</h3>
                      <p className="text-sm text-muted-foreground max-w-xs ml-auto">{step.description}</p>
                    </div>
                  )}
                </div>

                <div className="hidden md:flex flex-col items-center relative z-10">
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg shadow-${step.color.split(" ")[0].replace("from-", "")}/20`}
                  >
                    <step.icon className="h-5 w-5 text-white" />
                  </motion.div>
                  {i < steps.length - 1 && (
                    <div className="w-px h-8 bg-gradient-to-b from-primary/20 to-transparent" />
                  )}
                </div>

                <div className="hidden md:flex md:w-1/2">
                  {i % 2 === 1 && (
                    <div className="text-left pl-8">
                      <h3 className="text-base font-semibold text-foreground mb-1">{step.title}</h3>
                      <p className="text-sm text-muted-foreground max-w-xs">{step.description}</p>
                    </div>
                  )}
                </div>

                <div className="md:hidden flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-md shrink-0`}>
                    <step.icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-0.5">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
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
