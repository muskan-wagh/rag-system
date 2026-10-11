"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { Play } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  ScrollHint,
  SectionIndicator,
  StackMarquee,
  StageBackdrop,
  StageBeam,
  StageChips,
  StageNodes,
  StageOrbits,
} from "@/components/landing/hero-stage"

const EASE = [0.16, 1, 0.3, 1] as const

/** Staged reveal: the stage lights up first, then the copy arrives. */
const rise = (i: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay: 0.25 + i * 0.09, ease: EASE },
})

export function LandingHero() {
  const reduced = useReducedMotion()

  return (
    <section className="dark relative isolate overflow-hidden">
      <StageBackdrop />

      <div className="relative flex min-h-[calc(100svh-72px)] flex-col sm:min-h-[calc(100svh-80px)]">
        {/* Decoration sits between the backdrop and the copy. */}
        <StageOrbits />
        <StageBeam />
        <StageNodes />
        <StageChips />

        <div className="container-page relative z-10 flex flex-1 flex-col items-center justify-center py-20 text-center sm:py-24">
          {/* Signature control from the reference: a slow orbit ring around a
              play glyph, floating above the headline. */}
          <motion.div
            initial={reduced ? undefined : { opacity: 0, scale: 0.8 }}
            animate={reduced ? undefined : { opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.1, ease: EASE }}
            className="relative flex size-11 items-center justify-center"
          >
            <span className="animate-ring-spin absolute inset-0 rounded-full border border-dashed border-white/20" />
            <span className="absolute inset-[7px] rounded-full border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm" />
            <Play className="size-3 translate-x-px fill-white/70 text-white/70" />
          </motion.div>

          <motion.div {...(reduced ? {} : rise(0))} className="mt-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[11.5px] font-medium text-white/70 backdrop-blur-md">
              <span className="relative flex size-1.5" aria-hidden>
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#CBE2D2] opacity-70" />
                <span className="relative inline-flex size-1.5 rounded-full bg-[#CBE2D2]" />
              </span>
              AI-assisted recruiting workspace
            </span>
          </motion.div>

          <motion.h1
            {...(reduced ? {} : rise(1))}
            className="mt-7 max-w-4xl text-balance text-[40px] font-medium leading-[1.02] tracking-[-0.04em] text-white sm:text-[62px] lg:text-[76px]"
          >
            Rank every resume.
            <br />
            <span className="bg-gradient-to-r from-white/50 via-white/30 to-white/[0.04] bg-clip-text text-transparent">
              Justify every decision.
            </span>
          </motion.h1>

          <motion.p
            {...(reduced ? {} : rise(2))}
            className="mt-6 max-w-xl text-pretty text-[15px] leading-relaxed text-white/55 sm:text-[16px]"
          >
            HireStack screens every applicant against your job description using
            semantic retrieval, shows exactly which experience drove each score, and
            carries the shortlist through assessments, interviews and a gated offer
            pipeline — with a complete audit trail.
          </motion.p>

          <motion.div
            {...(reduced ? {} : rise(3))}
            className="mt-9 flex flex-wrap items-center justify-center gap-3"
          >
            <Link
              href="/sign-up"
              className={cn(
                "group inline-flex h-11 items-center gap-2 rounded-full bg-white px-6 text-[14px] font-medium text-[#0A0A0A]",
                "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                "hover:bg-[#CBE2D2] hover:shadow-[0_0_40px_-8px_rgba(203,226,210,0.55)]",
              )}
            >
              Start hiring
              <svg
                viewBox="0 0 16 16"
                className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M3 8h9.5M9 4.5 12.5 8 9 11.5" />
              </svg>
            </Link>

            <a
              href="#product"
              className={cn(
                "inline-flex h-11 items-center gap-2 rounded-full border border-white/15 px-5 text-[14px] font-medium text-white/80",
                "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                "hover:border-white/30 hover:bg-white/[0.06] hover:text-white",
              )}
            >
              <span className="relative flex size-4 items-center justify-center">
                <span className="absolute size-4 animate-ring-spin rounded-full border border-dashed border-white/25" />
                <Play className="size-2.5 translate-x-px fill-white/80 text-white/80" />
              </span>
              See the workflow
            </a>
          </motion.div>

          <motion.div
            {...(reduced ? {} : rise(4))}
            className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2"
          >
            {[
              "Semantic screening",
              "An explanation on every score",
              "Hiring stays a recruiter decision",
            ].map((item) => (
              <span key={item} className="flex items-center gap-2 text-[12.5px] text-white/45">
                <span className="size-1 rounded-full bg-[#CBE2D2]/70" aria-hidden />
                {item}
              </span>
            ))}
          </motion.div>
        </div>

        {/* Frame furniture + logo strip. */}
        <div className="relative z-10">
          <div className="container-page flex items-end justify-between gap-6 pb-6">
            <motion.div
              initial={reduced ? undefined : { opacity: 0, y: 10 }}
              animate={reduced ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.75, ease: EASE }}
            >
              <ScrollHint />
            </motion.div>

            <motion.div
              initial={reduced ? undefined : { opacity: 0, y: 10 }}
              animate={reduced ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.85, ease: EASE }}
            >
              <SectionIndicator />
            </motion.div>
          </div>

          <div className="border-t border-white/[0.06]">
            <StackMarquee />
          </div>
        </div>
      </div>
    </section>
  )
}