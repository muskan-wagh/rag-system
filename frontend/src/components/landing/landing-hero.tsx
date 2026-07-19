"use client"

import { motion } from "framer-motion"
import { ArrowRight, Sparkles, Check } from "lucide-react"
import { PrimaryButton } from "@/components/ui/primary-button"
import { SecondaryButton } from "@/components/ui/secondary-button"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
}

function ScoreRing({ value, size = 40 }: { value: number; size?: number }) {
  const r = (size - 8) / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference - (value / 100) * circumference

  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E2E2E0" strokeWidth="3" />
      <circle
        cx={cx} cy={cy} r={r} fill="none" stroke="#1E40AF" strokeWidth="3"
        strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
        className="transition-all duration-700"
      />
    </svg>
  )
}

function DashboardMockup() {
  return (
    <div className="relative w-full max-w-[600px] mx-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
        className="relative z-10"
      >
        <div className="rounded-xl overflow-hidden border border-border bg-surface">
          <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border bg-[#FAFAFA]">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-border" />
              <div className="w-2.5 h-2.5 rounded-full bg-border" />
              <div className="w-2.5 h-2.5 rounded-full bg-border" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="rounded-md px-3 py-0.5 text-[10px] text-faint font-medium border border-border" style={{ fontFamily: "var(--font-inter)" }}>
                dashboard.recruitiq.ai
              </div>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Total", value: "1,247" },
                { label: "Avg Match", value: "89%" },
                { label: "Interviews", value: "18" },
                { label: "Hired", value: "12" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg p-3 bg-[#FAFAFA] border border-border">
                  <p className="font-data text-lg font-medium text-ink">{stat.value}</p>
                  <p className="text-[10px] text-faint uppercase mt-0.5" style={{ letterSpacing: "0.04em", fontFamily: "var(--font-inter)" }}>{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              {[
                { name: "Sarah Kim", role: "Sr. Frontend Engineer", skills: "React · TS · 6yrs", score: 96 },
                { name: "James Mitchell", role: "Full-Stack Engineer", skills: "Vue · Node · 8yrs", score: 92 },
                { name: "Emily Zhao", role: "ML Engineer", skills: "Python · TF · 4yrs", score: 88 },
                { name: "David Park", role: "Backend Engineer", skills: "Go · AWS · 7yrs", score: 84 },
              ].map((c) => (
                <div key={c.name} className="rounded-lg px-4 py-3 bg-[#FAFAFA] border border-border hover:border-border-hover transition-all duration-120">
                  <div className="flex items-center gap-3">
                    <ScoreRing value={c.score} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-ink" style={{ fontFamily: "var(--font-inter)" }}>{c.name}</span>
                        <span className="text-xs text-muted" style={{ fontFamily: "var(--font-inter)" }}>{c.role}</span>
                      </div>
                      <p className="text-xs text-faint mt-0.5" style={{ fontFamily: "var(--font-inter)" }}>{c.skills} — <span className="font-data text-ink font-medium">{c.score}%</span></p>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-ink bg-[#F3F4F6]" style={{ fontFamily: "var(--font-inter)" }}>
                      <Sparkles className="h-2.5 w-2.5" />
                      Match
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function TrustBadges() {
  const badges = [
    { icon: Check, text: "Used by 120+ hiring teams" },
    { icon: Check, text: "AI-powered ranking" },
    { icon: Check, text: "Enterprise security" },
  ]
  return (
    <div className="flex flex-wrap gap-4 mt-6">
      {badges.map((badge) => (
        <div key={badge.text} className="flex items-center gap-1.5 text-xs text-muted" style={{ fontFamily: "var(--font-inter)" }}>
          <badge.icon className="h-3.5 w-3.5 text-info" />
          {badge.text.split(/(\d+\+?)/).map((part, j) =>
            /^\d+\+?$/.test(part) ? <span key={j} className="font-data">{part}</span> : <span key={j}>{part}</span>
          )}
        </div>
      ))}
    </div>
  )
}

export function LandingHero() {
  return (
    <section className="relative w-full overflow-hidden pt-24 pb-20 md:pt-32 md:pb-28">
      <div className="mx-auto max-w-7xl px-4 md:px-8 relative">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="max-w-xl"
          >
            <motion.div variants={itemVariants}>
              <div className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#F3F4F6] px-3 py-1 text-xs font-medium text-muted mb-6" style={{ fontFamily: "var(--font-inter)" }}>
                <Sparkles className="h-3 w-3 text-ink" />
                AI-Powered Recruitment Engine
              </div>
            </motion.div>

            <motion.h1
              variants={itemVariants}
              className="text-5xl sm:text-6xl md:text-7xl lg:text-[72px] font-medium tracking-tight leading-[1.04] text-ink"
              style={{ letterSpacing: "-0.02em", fontFamily: "var(--font-inter)" }}
            >
              Discover top talent with{" "}
              <span className="text-muted">AI</span>
            </motion.h1>



            <motion.div variants={itemVariants} className="flex flex-wrap gap-3 mt-8">
              <PrimaryButton href="/sign-up" icon={<ArrowRight className="h-4 w-4" />}>
                Start Hiring Free
              </PrimaryButton>
              <SecondaryButton href="/#features">
                See How It Works
              </SecondaryButton>
            </motion.div>

            <motion.div variants={itemVariants}>
              <TrustBadges />
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative"
          >
            <DashboardMockup />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
