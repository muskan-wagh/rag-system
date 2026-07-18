"use client"

import { motion } from "framer-motion"
import { Sparkles, FileText, BarChart3, Users, CheckCircle, Search } from "lucide-react"
import { SectionHeader } from "@/components/ui/section-header"

const floatingCards = [
  { icon: Sparkles, label: "AI Match", value: "96%", color: "from-primary to-accent", x: "-10%", y: "5%", delay: 0 },
  { icon: FileText, label: "Resume Summary", value: "Parsed", color: "from-blue-500 to-indigo-400", x: "85%", y: "-5%", delay: 0.5 },
  { icon: BarChart3, label: "Hiring Score", value: "92", color: "from-warning to-accent", x: "-8%", y: "70%", delay: 1 },
  { icon: Users, label: "Candidate Fit", value: "Strong", color: "from-primary to-accent", x: "80%", y: "75%", delay: 1.5 },
  { icon: CheckCircle, label: "Interview Ready", value: "Yes", color: "from-success to-accent", x: "50%", y: "-8%", delay: 2 },
  { icon: Search, label: "Semantic Search", value: "Active", color: "from-accent to-accent", x: "45%", y: "85%", delay: 2.5 },
]

export function ProductShowcase() {
  return (
    <section className="w-full py-20 md:py-28 bg-gradient-to-b from-background via-primary/[0.02] to-background relative overflow-hidden">
      <div className="absolute inset-0 grid-bg pointer-events-none opacity-30" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/[0.04] rounded-full blur-3xl" />

      <div className="mx-auto max-w-7xl px-4 md:px-8 relative">
        <SectionHeader
          label="Product"
          title="See RecruitIQ"
          highlight="in action"
          description="A powerful dashboard that gives you complete visibility into your candidate pipeline"
        />

        <div className="relative mt-8">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6 }}
            className="relative z-10 max-w-5xl mx-auto"
          >
            <div className="glass-strong rounded-2xl overflow-hidden shadow-2xl shadow-primary/5 border border-white/60">
              <div className="flex items-center gap-1.5 bg-white/60 border-b border-white/40 px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400/60" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400/60" />
                  <div className="w-3 h-3 rounded-full bg-primary/40" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="bg-white/50 rounded-md px-3 py-0.5 text-xs text-muted-foreground/60 font-medium">
                    dashboard.recruitiq.ai
                  </div>
                </div>
                <div className="w-16" />
              </div>
              <div className="p-6 md:p-8 bg-gradient-to-br from-white/40 to-white/10">
                <div className="grid md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-white/50 rounded-xl p-4 border border-white/40">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Total Candidates</p>
                    <p className="text-2xl font-bold text-foreground">1,247</p>
                    <p className="text-xs text-primary font-medium mt-1">+12% this week</p>
                  </div>
                  <div className="bg-white/50 rounded-xl p-4 border border-white/40">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Avg. Match Score</p>
                    <p className="text-2xl font-bold text-foreground">86%</p>
                    <p className="text-xs text-primary font-medium mt-1">+5% improvement</p>
                  </div>
                  <div className="bg-white/50 rounded-xl p-4 border border-white/40">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Open Positions</p>
                    <p className="text-2xl font-bold text-foreground">24</p>
                    <p className="text-xs text-primary font-medium mt-1">8 urgent</p>
                  </div>
                </div>
                <div className="bg-white/60 rounded-xl p-4 border border-white/40">
                  <p className="text-xs font-semibold text-muted-foreground mb-3">Top Candidates · Senior Frontend Engineer</p>
                  <div className="space-y-2">
                    {[
                      { name: "Sarah Kim", score: 96, skills: "React · TypeScript · 6yr" },
                      { name: "James Mitchell", score: 92, skills: "Vue · Node · 8yr" },
                      { name: "Emily Zhao", score: 89, skills: "React · Python · 4yr" },
                      { name: "David Park", score: 85, skills: "Angular · Go · 7yr" },
                    ].map((c) => (
                      <div key={c.name} className="flex items-center gap-3 py-1.5">
                        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">
                          {c.name.split(" ").map(n => n[0]).join("")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{c.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{c.skills}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 bg-white/60 rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${c.score}%` }} />
                          </div>
                          <span className="text-xs font-bold text-primary">{c.score}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {floatingCards.map((card) => (
            <motion.div
              key={card.label}
              className="absolute hidden lg:block z-20"
              style={{ left: card.x, top: card.y }}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: card.delay + 0.3, duration: 0.4 }}
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 3 + card.delay, repeat: Infinity, ease: "easeInOut" }}
                className="glass-strong rounded-xl px-4 py-2.5 shadow-lg border border-white/50 whitespace-nowrap"
              >
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                    <card.icon className="h-3 w-3 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{card.label}</p>
                    <p className="text-sm font-bold text-foreground">{card.value}</p>
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
