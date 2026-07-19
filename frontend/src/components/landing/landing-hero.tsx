"use client"

import { motion } from "framer-motion"
import { ArrowRight, Sparkles, Shield, Users, Check, Search, Bell, TrendingUp, Calendar } from "lucide-react"
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
  const color = value >= 90 ? "#22C55E" : value >= 75 ? "#6366F1" : value >= 60 ? "#F59E0B" : "#EF4444"

  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="3" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-700" />
    </svg>
  )
}

function DashboardMockup() {
  const candidates = [
    { initials: "SK", name: "Sarah Kim", role: "Sr. Frontend Engineer", skills: "React · TS · 6yrs", score: 96 },
    { initials: "JM", name: "James Mitchell", role: "Full-Stack Engineer", skills: "Vue · Node · 8yrs", score: 92 },
    { initials: "EZ", name: "Emily Zhao", role: "ML Engineer", skills: "Python · TF · 4yrs", score: 88 },
    { initials: "DP", name: "David Park", role: "Backend Engineer", skills: "Go · AWS · 7yrs", score: 84 },
  ]

  return (
    <div className="relative w-full max-w-[600px] mx-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
        className="relative z-10"
      >
        <div className="rounded-2xl overflow-hidden shadow-2xl shadow-indigo-500/10 border border-white/20 bg-white/90 backdrop-blur-sm">
          <div className="flex items-center gap-1.5 px-4 py-3 border-b border-gray-200/60 bg-gray-50/80">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-primary/50" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="rounded-md px-3 py-0.5 text-[10px] text-muted-foreground/50 font-medium bg-white/40 border border-gray-200/40">
                dashboard.recruitiq.ai
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Search className="h-3 w-3 text-muted-foreground/40" />
              <Bell className="h-3 w-3 text-muted-foreground/40" />
              <div className="w-5 h-5 rounded-full bg-primary/50 flex items-center justify-center text-[8px] font-bold text-white">U</div>
            </div>
          </div>

          <div className="p-4 md:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Candidate Overview</p>
                <p className="text-[9px] text-muted-foreground/40">Senior Frontend Engineer · Google</p>
              </div>
              <div className="flex items-center gap-1.5 bg-primary/10 text-primary text-[10px] font-bold px-2.5 py-1 rounded-lg border border-primary/20">
                <Sparkles className="h-3 w-3" />
                AI Match 96%
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Total", value: "1,247", icon: Users, color: "text-sky-400", bg: "bg-sky-500/10" },
                { label: "Avg Match", value: "89%", icon: TrendingUp, color: "text-primary", bg: "bg-primary/10" },
                { label: "Interviews", value: "18", icon: Calendar, color: "text-amber-400", bg: "bg-amber-500/10" },
                { label: "Hired", value: "12", icon: Check, color: "text-emerald-400", bg: "bg-emerald-500/10" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl p-2.5 bg-white/60 border border-gray-200/50 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                  <div className={`w-5 h-5 rounded-lg ${stat.bg} flex items-center justify-center mb-1.5`}>
                    <stat.icon className={`h-2.5 w-2.5 ${stat.color}`} />
                  </div>
                  <p className="text-[11px] font-bold text-foreground">{stat.value}</p>
                  <p className="text-[7px] text-muted-foreground/50 uppercase tracking-wider">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              {candidates.map((c) => (
                <div key={c.name} className="group rounded-xl px-3 py-2.5 bg-white/70 border border-gray-200/50 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:bg-white hover:border-gray-300/60 hover:shadow-md transition-all duration-200">
                  <div className="flex items-center gap-3">
                    <ScoreRing value={c.score} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-foreground">{c.name}</span>
                        <span className="text-[8px] text-muted-foreground/50">{c.role}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[8px] text-muted-foreground/60">{c.skills}</span>
                        <span className="text-[8px] font-bold text-primary">{c.score}%</span>
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-[8px] font-semibold text-primary border border-primary/20">
                      <Sparkles className="h-2.5 w-2.5" />
                      Match
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl p-3.5 bg-white/70 border border-gray-200/50 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Skill Alignment</span>
                <span className="text-[8px] text-muted-foreground/40">vs Job Description</span>
              </div>
              <div className="space-y-2">
                {[
                  { label: "React", value: 95 },
                  { label: "TypeScript", value: 88 },
                  { label: "System Design", value: 82 },
                  { label: "Leadership", value: 76 },
                ].map((skill) => (
                  <div key={skill.label}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[8px] font-medium text-muted-foreground/70">{skill.label}</span>
                      <span className="text-[8px] font-bold text-foreground/80">{skill.value}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-200/60 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${skill.value}%` }}
                        transition={{ duration: 0.8, delay: 0.3 + skill.value * 0.005, ease: "easeOut" }}
                        className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-5 -right-5 z-20"
      >
        <div className="rounded-xl px-3.5 py-2 shadow-lg border border-white/30 bg-white/90 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-bold text-foreground">AI Score: 96</span>
          </div>
        </div>
      </motion.div>

      <motion.div
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute -bottom-3 -left-6 z-20"
      >
        <div className="rounded-xl px-3.5 py-2 shadow-lg border border-white/30 bg-white/90 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-bold text-foreground">Bias Free</span>
          </div>
        </div>
      </motion.div>

      <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-3xl bg-gradient-to-br from-primary/10 via-indigo-500/5 to-transparent" />
      <div className="absolute -z-10 top-0 right-0 w-[300px] h-[300px] rounded-full blur-3xl bg-blue-500/5" />
      <div className="absolute -z-10 -bottom-10 -left-10 w-[250px] h-[250px] rounded-full blur-3xl bg-indigo-500/5" />
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
        <div key={badge.text} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <badge.icon className="h-3.5 w-3.5 text-primary" />
          {badge.text}
        </div>
      ))}
    </div>
  )
}

export function LandingHero() {
  return (
    <section className="relative w-full overflow-hidden pt-24 pb-20 md:pt-32 md:pb-28">
      <div className="absolute inset-0 noise-bg pointer-events-none" />
      <div className="absolute inset-0 grid-bg pointer-events-none opacity-40" />

      <div className="mx-auto max-w-7xl px-4 md:px-8 relative">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="max-w-xl"
          >
            <motion.div variants={itemVariants}>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/70 backdrop-blur-sm px-3.5 py-1 text-xs font-medium text-muted-foreground shadow-sm mb-6">
                <Sparkles className="h-3 w-3 text-primary" />
                AI-Powered Recruitment Engine
              </div>
            </motion.div>

            <motion.h1
              variants={itemVariants}
              className="text-5xl sm:text-6xl md:text-7xl lg:text-[72px] font-bold tracking-tight leading-[1.04] text-foreground"
            >
              Discover top talent with{" "}
              <span className="text-gradient bg-gradient-to-r from-primary via-accent to-primary">AI</span>
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="mt-5 text-base md:text-lg text-muted-foreground leading-relaxed max-w-lg"
            >
              Search, rank, and compare candidates with AI-powered semantic matching and explainable insights. Find the right candidate in seconds.
            </motion.p>

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
