"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { ArrowRight, Sparkles, Shield, Users, Check } from "lucide-react"
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

function DashboardMockup() {
  return (
    <div className="relative w-full max-w-[580px] mx-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
        className="relative z-10"
      >
        <div className="glass-strong rounded-2xl overflow-hidden shadow-2xl shadow-primary/5 border border-white/60">
          <div className="flex items-center gap-1.5 bg-white/60 border-b border-white/40 px-4 py-2.5">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/60" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="bg-white/40 rounded-md px-3 py-0.5 text-[10px] text-muted-foreground/60 font-medium">
                RecruitIQ Dashboard
              </div>
            </div>
            <div className="w-14" />
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Candidate Rankings</p>
                <p className="text-[9px] text-muted-foreground/50">Senior Frontend Engineer · Google</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-md">AI Match 96%</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/50 rounded-xl p-3 border border-white/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-medium text-muted-foreground">Candidate</span>
                  <span className="text-[9px] font-bold text-primary">92</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center text-white text-[10px] font-bold">SK</div>
                  <div>
                    <p className="text-[11px] font-medium">Sarah Kim</p>
                    <p className="text-[8px] text-muted-foreground">React · TypeScript · 6yr</p>
                  </div>
                </div>
                <div className="mt-2 h-1.5 bg-white/60 rounded-full overflow-hidden">
                  <div className="h-full w-[92%] bg-gradient-to-r from-primary to-emerald-400 rounded-full" />
                </div>
              </div>
              <div className="bg-white/50 rounded-xl p-3 border border-white/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-medium text-muted-foreground">Candidate</span>
                  <span className="text-[9px] font-bold text-primary">88</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-400 flex items-center justify-center text-white text-[10px] font-bold">JM</div>
                  <div>
                    <p className="text-[11px] font-medium">James M.</p>
                    <p className="text-[8px] text-muted-foreground">Vue · Node · 8yr</p>
                  </div>
                </div>
                <div className="mt-2 h-1.5 bg-white/60 rounded-full overflow-hidden">
                  <div className="h-full w-[88%] bg-gradient-to-r from-primary to-emerald-400 rounded-full" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white/50 rounded-lg p-2 border border-white/30 text-center">
                <div className="flex items-center justify-center gap-1">
                  <span className="text-[9px] text-muted-foreground">Resume</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                </div>
                <p className="text-[10px] font-bold text-foreground">Parsed</p>
              </div>
              <div className="bg-white/50 rounded-lg p-2 border border-white/30 text-center">
                <div className="flex items-center justify-center gap-1">
                  <span className="text-[9px] text-muted-foreground">Status</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                </div>
                <p className="text-[10px] font-bold text-foreground">Interview</p>
              </div>
              <div className="bg-white/50 rounded-lg p-2 border border-white/30 text-center">
                <div className="flex items-center justify-center gap-1">
                  <span className="text-[9px] text-muted-foreground">Skills</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                </div>
                <p className="text-[10px] font-bold text-foreground">14/16</p>
              </div>
            </div>
            <div className="bg-white/50 rounded-xl p-3 border border-white/40">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-medium text-muted-foreground">Semantic Match Overview</span>
                <span className="text-[9px] text-muted-foreground">vs JD</span>
              </div>
              <div className="space-y-1.5">
                {[
                  { label: "React", value: 95 },
                  { label: "TypeScript", value: 88 },
                  { label: "System Design", value: 82 },
                  { label: "Leadership", value: 76 },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <span className="text-[8px] font-medium text-muted-foreground w-16">{item.label}</span>
                    <div className="flex-1 h-1 bg-white/60 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-emerald-400 rounded-full"
                        style={{ width: `${item.value}%` }}
                      />
                    </div>
                    <span className="text-[8px] font-bold text-foreground">{item.value}%</span>
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
        className="absolute -top-6 -right-6 z-20"
      >
        <div className="glass-strong rounded-xl px-3.5 py-2 shadow-lg border border-white/50">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-semibold">AI Score: 96</span>
          </div>
        </div>
      </motion.div>

      <motion.div
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute -bottom-4 -left-8 z-20"
      >
        <div className="glass-strong rounded-xl px-3.5 py-2 shadow-lg border border-white/50">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-[10px] font-semibold">Bias Free</span>
          </div>
        </div>
      </motion.div>

      <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-primary/5 rounded-full blur-3xl animate-pulse-glow" />
      <div className="absolute -z-10 top-1/3 right-0 w-[200px] h-[200px] bg-emerald-400/5 rounded-full blur-3xl" />
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
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-primary/[0.07] via-emerald-400/[0.03] to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-0 w-[300px] h-[300px] bg-primary/5 rounded-full blur-3xl animate-blob pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-400/5 rounded-full blur-3xl animate-blob pointer-events-none" style={{ animationDelay: "-3s" }} />

      <div className="mx-auto max-w-7xl px-4 md:px-8 relative">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="max-w-xl"
          >
            <motion.div variants={itemVariants}>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/70 backdrop-blur-sm px-3.5 py-1 text-xs font-medium text-muted-foreground shadow-sm mb-6">
                <Sparkles className="h-3 w-3 text-primary" />
                AI-Powered Recruitment Engine
              </div>
            </motion.div>

            <motion.h1
              variants={itemVariants}
              className="text-5xl sm:text-6xl md:text-7xl lg:text-[72px] font-bold tracking-tight leading-[1.04] text-foreground"
            >
              Discover top talent with{" "}
              <span className="text-gradient bg-gradient-to-r from-primary via-teal-400 to-emerald-400">AI</span>
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
