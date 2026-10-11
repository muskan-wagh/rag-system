"use client"

import { motion } from "framer-motion"
import {
  Bot,
  CalendarClock,
  Code2,
  FileBarChart,
  Layers,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { MarketingSection } from "@/components/ui/marketing-section"
import { SectionHeader } from "@/components/ui/section-header"
import { cn } from "@/lib/utils"

interface Feature {
  icon: LucideIcon
  title: string
  body: string
  /** Columns out of 6 on large screens. */
  span: 2 | 3 | 4 | 6
  /** Rendered under the copy on the lead card only. */
  visual?: React.ReactNode
}

const FEATURES: Feature[] = [
  {
    icon: Bot,
    title: "Semantic screening, not keyword counting",
    body: "Resumes are embedded and retrieved against the job description, so a candidate who solved the problem without using your exact keyword still ranks. Every score ships with the reasoning that produced it, and you can override any of them.",
    span: 4,
    visual: (
      <ul className="mt-6 grid gap-2 sm:grid-cols-3">
        {[
          { label: "Semantic", value: 35 },
          { label: "Skills", value: 30 },
          { label: "Experience", value: 20 },
        ].map((w) => (
          <li key={w.label} className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
            <p className="flex items-baseline justify-between">
              <span className="text-[11.5px] text-white/50">{w.label}</span>
              <span className="font-data text-[13px] font-medium text-white">{w.value}%</span>
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#CBE2D2]/80 to-white/90"
                style={{ width: `${w.value * 2.5}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    ),
  },
  {
    icon: Users,
    title: "Compare before you decide",
    body: "Put candidates side by side on score, skills and gaps, then act on the difference.",
    span: 2,
  },
  {
    icon: CalendarClock,
    title: "Scheduling built in",
    body: "Invite candidates to a stage and send the confirmation automatically.",
    span: 2,
  },
  {
    icon: Code2,
    title: "Live coding, observed live",
    body: "Push a problem into the shared editor and watch the code and its test results as it is written.",
    span: 2,
  },
  {
    icon: FileBarChart,
    title: "Reports, not screenshots",
    body: "Generate a candidate report from the full history, download it as a PDF, and send it to the candidate.",
    span: 2,
  },
  {
    icon: Layers,
    title: "Pools and saved searches",
    body: "Group candidates into talent pools and save a search with its filters to re-run later.",
    span: 2,
  },
  {
    icon: Send,
    title: "Outreach in one place",
    body: "Draft and send candidate emails from the profile, with the thread kept against the record.",
    span: 2,
  },
  {
    icon: ShieldCheck,
    title: "Transitions you cannot get wrong",
    body: "Stages never skip or move backwards, and Offer to Hired is recruiter-only — no score or automation can hire on your behalf.",
    span: 6,
  },
]

export function FeaturesBento() {
  return (
    <MarketingSection id="features">
      <SectionHeader
        label="Capabilities"
        title={
          <>
            Everything the workflow needs,{" "}
            <span className="text-white/45">nothing it doesn&rsquo;t.</span>
          </>
        }
        description="Each capability is part of one connected system, so a decision made at screening is the same decision you can defend at offer stage."
      />

      <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {FEATURES.map((feature, i) => (
          <motion.article
            key={feature.title}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5, delay: (i % 3) * 0.06, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 backdrop-blur-xl",
              "transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
              "hover:-translate-y-1 hover:border-[#CBE2D2]/30 hover:bg-white/[0.045]",
              "hover:shadow-[0_24px_60px_-28px_rgba(203,226,210,0.3)] sm:p-6",
              feature.span === 2 && "lg:col-span-2",
              feature.span === 3 && "lg:col-span-3",
              feature.span === 4 && "lg:col-span-4",
              feature.span === 6 && "lg:col-span-6",
            )}
          >
            {/* Hairline that lights up along the top edge on hover. */}
            <span
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              aria-hidden
            />

            <div className="flex items-start gap-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[#CBE2D2] transition-all duration-500 group-hover:border-[#CBE2D2]/30 group-hover:bg-[#CBE2D2]/10 group-hover:shadow-[0_0_24px_-6px_rgba(203,226,210,0.5)]">
                <feature.icon className="size-4" strokeWidth={1.75} aria-hidden />
              </span>
              <div className="min-w-0">
                <h3 className="text-balance text-[15px] font-medium leading-snug tracking-tight text-white">
                  {feature.title}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-white/50">{feature.body}</p>
              </div>
            </div>

            {feature.visual && <div className="mt-auto pt-6">{feature.visual}</div>}
          </motion.article>
        ))}
      </div>
    </MarketingSection>
  )
}
