"use client"

import { motion } from "framer-motion"
import { FileSearch, Ruler, Scale, Sparkles } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { MarketingSection } from "@/components/ui/marketing-section"
import { SectionHeader } from "@/components/ui/section-header"

interface Step {
  icon: LucideIcon
  title: string
  body: string
}

/** These mirror the shipped retrieval + ranking services, not a pitch. */
const STEPS: Step[] = [
  {
    icon: FileSearch,
    title: "Parse the role",
    body: "The job description is broken into the things you actually screen on: required skills, an experience range, and an education expectation. You can correct any of them before screening runs.",
  },
  {
    icon: Sparkles,
    title: "Embed and retrieve",
    body: "Each resume is embedded into a 384-dimensional vector and stored alongside the rest. Screening retrieves candidates by vector similarity to the role, so related experience surfaces even when the wording differs.",
  },
  {
    icon: Scale,
    title: "Score four dimensions",
    body: "Semantic similarity, skill coverage, experience fit and education are each computed independently — none of them can hide a weakness in another.",
  },
  {
    icon: Ruler,
    title: "Rank, explain, hand back control",
    body: "The dimensions combine into one overall score that orders the shortlist, and each candidate comes back with the breakdown and a written explanation. Override any score; the ranking is a starting point, not a verdict.",
  },
]

/** The exact weights implemented in `backend/src/services/ranking/finalRanker.ts`. */
const WEIGHTS = [
  { label: "Semantic similarity", value: 35, tone: "bg-accent" },
  { label: "Skill coverage", value: 30, tone: "bg-ink" },
  { label: "Experience fit", value: 20, tone: "bg-info" },
  { label: "Education", value: 15, tone: "bg-faint" },
]

export function HowItWorksSection() {
  return (
    <MarketingSection id="how-it-works" tone="surface">
      <SectionHeader
        label="How it works"
        title={
          <>
            A ranking you can{" "}
            <span className="text-white/45">take apart.</span>
          </>
        }
        description="The scoring is a published formula with fixed weights, not a black box. Here is exactly what happens when you run a screening."
      />

      <div className="mt-14 grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <ol className="space-y-3">
          {STEPS.map((step, i) => (
            <motion.li
              key={step.title}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.45, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
              className="group flex gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 backdrop-blur-xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.045]"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[#CBE2D2] transition-all duration-500 group-hover:border-[#CBE2D2]/30 group-hover:bg-[#CBE2D2]/10">
                <step.icon className="size-4" strokeWidth={1.75} aria-hidden />
              </span>
              <div>
                <h3 className="text-[14.5px] font-medium tracking-tight text-white">
                  <span className="mr-2 font-data text-[12px] text-white/35">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {step.title}
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-white/50">{step.body}</p>
              </div>
            </motion.li>
          ))}
        </ol>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="lg:sticky lg:top-28 lg:self-start"
        >
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6 backdrop-blur-xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/45">
              Overall score
            </p>

            <div className="mt-5 space-y-4">
              {WEIGHTS.map((w) => (
                <div key={w.label}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="text-[13px] text-white/85">{w.label}</span>
                    <span className="font-data text-[13px] font-medium text-white">
                      {w.value}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
                    <motion.div
                      className={`h-full rounded-full ${w.tone}`}
                      initial={{ width: 0 }}
                      whileInView={{ width: `${w.value}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
              <p className="font-data text-[11.5px] leading-relaxed text-white/80">
                overall = 0.35 × semantic
                <br />
                <span className="pl-4">+ 0.30 × skills</span>
                <br />
                <span className="pl-4">+ 0.20 × experience</span>
                <br />
                <span className="pl-4">+ 0.15 × education</span>
              </p>
            </div>

            <p className="mt-4 text-[12px] leading-relaxed text-white/45">
              Education carries the least weight on purpose — it is the dimension most
              likely to filter out good people when treated as a hard requirement.
            </p>
          </div>
        </motion.div>
      </div>
    </MarketingSection>
  )
}
