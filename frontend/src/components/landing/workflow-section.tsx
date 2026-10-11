"use client"

import { motion } from "framer-motion"
import { ArrowRight, ShieldCheck } from "lucide-react"
import { MarketingSection } from "@/components/ui/marketing-section"
import { SectionHeader } from "@/components/ui/section-header"
import { ScreeningPreview } from "@/components/landing/product-preview"

/**
 * Mirrors the backend's canonical pipeline (services/hiring/stageTypes.ts).
 * The backend rejects skipped and backwards transitions server-side, so this
 * is the same sequence a recruiter actually sees.
 */
const STEPS = [
  {
    stage: "Applied",
    title: "Application lands",
    body: "A resume is attached to a role through a unique upload link. It enters the pipeline at Applied — nothing else can jump the queue.",
    verb: "Create role",
  },
  {
    stage: "Screening",
    title: "AI resume screening",
    body: "Each resume is embedded and matched against the job description. You get a ranked score for skills, experience and education, plus the reasoning behind it.",
    verb: "Run screening",
  },
  {
    stage: "Assessment",
    title: "Generate & invite",
    body: "Build a timed assessment from the role's own skills, or write your own. Invite eligible candidates in bulk and track who has started.",
    verb: "Publish",
  },
  {
    stage: "Technical Interview",
    title: "Video + live coding",
    body: "Schedule the round, push a coding problem into the shared session, and watch the candidate's code run against test cases as they write it.",
    verb: "Schedule",
  },
  {
    stage: "Managerial/HR",
    title: "Structured evaluation",
    body: "Interviewers score against a fixed rubric so feedback is comparable. Every rating is stored against the candidate, not lost in a calendar invite.",
    verb: "Evaluate",
  },
  {
    stage: "Offer",
    title: "Report & decision",
    body: "Generate the candidate report, review the full history, and record the decision. Sending the offer and marking the hire are both explicit recruiter actions.",
    verb: "Send offer",
  },
] as const

export function WorkflowSection() {
  return (
    <MarketingSection id="pipeline">
      <SectionHeader
        label="The pipeline"
        title={
          <>
            Six connected stages,{" "}
            <span className="text-white/45">no black boxes in between.</span>
          </>
        }
        description="Every candidate moves through the same ordered pipeline. Stages never move backwards, never skip, and the final hire is always a person’s decision — not an automation’s."
      />

      <div className="relative mt-16">
        {/* Connecting rail — desktop only. A light runs along it so the
            pipeline reads as one continuous path. */}
        <div
          className="pointer-events-none absolute left-0 right-0 top-[38px] hidden h-px bg-white/[0.07] lg:block"
          aria-hidden
        >
          <span className="animate-line-flow absolute inset-y-0 left-0 w-24 bg-[linear-gradient(to_right,transparent,rgba(255,255,255,0.55),transparent)]" />
        </div>

        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((step, i) => (
            <motion.li
              key={step.stage}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: (i % 3) * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="group relative flex flex-col rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 backdrop-blur-xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.045]"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] font-data text-[11px] font-medium text-white/60 transition-colors duration-500 group-hover:border-[#CBE2D2]/30 group-hover:text-[#CBE2D2]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.06em] text-white/50">
                  {step.stage === "Technical Interview"
                    ? "Technical"
                    : step.stage === "Managerial/HR"
                      ? "Managerial / HR"
                      : step.stage}
                </span>
              </div>

              <h3 className="mt-4 text-[15px] font-medium tracking-tight text-white">{step.title}</h3>
              <p className="mt-2 flex-1 text-[13px] leading-relaxed text-white/50">{step.body}</p>

              <p className="mt-4 flex items-center gap-1.5 text-[11.5px] font-medium text-white/70 transition-colors duration-500 group-hover:text-white">
                <ArrowRight
                  className="size-3 text-[#CBE2D2] transition-transform duration-500 group-hover:translate-x-0.5"
                  aria-hidden
                />
                {step.verb}
              </p>
            </motion.li>
          ))}

          {/* Terminal state, styled as the destination rather than another task. */}
          <motion.li
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col rounded-2xl border border-[#CBE2D2]/25 bg-[#CBE2D2]/[0.06] p-5 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#CBE2D2]/15 text-[#CBE2D2]">
                <ShieldCheck className="size-4" strokeWidth={1.75} aria-hidden />
              </span>
              <span className="rounded-full border border-[#CBE2D2]/25 bg-[#CBE2D2]/10 px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.06em] text-[#CBE2D2]">
                Hired · terminal
              </span>
            </div>
            <h3 className="mt-4 text-[15px] font-medium tracking-tight text-white">Hired</h3>
            <p className="mt-2 flex-1 text-[13px] leading-relaxed text-white/50">
              The end of the line. Only a recruiter can move a candidate from Offer to
              Hired — no score, score threshold or automation can do it for you.
            </p>
          </motion.li>
        </ol>
      </div>

      {/* Show the screening step's actual output next to the description. */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="mt-16 grid items-center gap-10 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6 backdrop-blur-xl sm:p-10 lg:grid-cols-[0.85fr_1.15fr]"
      >
        <div>
          <h3 className="text-balance text-[24px] font-medium leading-tight tracking-[-0.02em] text-white sm:text-[28px]">
            Screening shows its work
          </h3>
          <p className="mt-4 text-pretty text-[14px] leading-relaxed text-white/50">
            A score on its own is not a decision. Each candidate comes back with the
            matched and missing skills, a breakdown by dimension, and a written
            explanation of why they ranked where they did — so you can overrule the
            ranking when your judgement says otherwise.
          </p>
          <ul className="mt-6 space-y-2.5">
            {[
              "Semantic match on skills, experience and education",
              "Missing-skill flags surfaced per candidate",
              "Recruiter override on any score",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[13px] text-white/55">
                <span
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#CBE2D2]"
                  aria-hidden
                />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <ScreeningPreview />
      </motion.div>
    </MarketingSection>
  )
}
