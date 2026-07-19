"use client"

import { motion } from "framer-motion"
import { SectionHeader } from "@/components/ui/section-header"

export function ProductShowcase() {
  return (
    <section className="w-full py-20 md:py-28 relative overflow-hidden">
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
            <div className="rounded-xl overflow-hidden border border-border bg-surface">
              <div className="flex items-center gap-1.5 bg-[#FAFAFA] border-b border-border px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-border" />
                  <div className="w-3 h-3 rounded-full bg-border" />
                  <div className="w-3 h-3 rounded-full bg-border" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="rounded-md px-3 py-0.5 text-xs text-faint font-medium border border-border" style={{ fontFamily: "var(--font-inter)" }}>
                    dashboard.recruitiq.ai
                  </div>
                </div>
                <div className="w-16" />
              </div>
              <div className="p-6 md:p-8">
                <div className="grid md:grid-cols-3 gap-4 mb-4">
                  <div className="rounded-lg bg-[#FAFAFA] border border-border p-4">
                    <p className="text-xs text-faint mb-1" style={{ fontFamily: "var(--font-inter)" }}>Total Candidates</p>
                    <p className="font-data text-2xl font-medium text-ink">1,247</p>
                    <p className="font-data text-xs text-ink mt-1">+12% this week</p>
                  </div>
                  <div className="rounded-lg bg-[#FAFAFA] border border-border p-4">
                    <p className="text-xs text-faint mb-1" style={{ fontFamily: "var(--font-inter)" }}>Avg. Match Score</p>
                    <p className="font-data text-2xl font-medium text-ink">86%</p>
                    <p className="font-data text-xs text-ink mt-1">+5% improvement</p>
                  </div>
                  <div className="rounded-lg bg-[#FAFAFA] border border-border p-4">
                    <p className="text-xs text-faint mb-1" style={{ fontFamily: "var(--font-inter)" }}>Open Positions</p>
                    <p className="font-data text-2xl font-medium text-ink">24</p>
                    <p className="font-data text-xs text-ink mt-1">8 urgent</p>
                  </div>
                </div>
                <div className="rounded-lg bg-[#FAFAFA] border border-border p-4">
                  <p className="text-xs font-medium text-muted mb-3" style={{ fontFamily: "var(--font-inter)" }}>Top Candidates · Senior Frontend Engineer</p>
                  <div className="space-y-2">
                    {[
                      { name: "Sarah Kim", score: 96, skills: "React · TypeScript · 6yr" },
                      { name: "James Mitchell", score: 92, skills: "Vue · Node · 8yr" },
                      { name: "Emily Zhao", score: 89, skills: "React · Python · 4yr" },
                      { name: "David Park", score: 85, skills: "Angular · Go · 7yr" },
                    ].map((c) => (
                      <div key={c.name} className="flex items-center gap-3 py-1.5">
                        <div className="w-7 h-7 rounded-full bg-[#E5E7EB] flex items-center justify-center text-xs font-medium text-muted" style={{ fontFamily: "var(--font-inter)" }}>
                          {c.name.split(" ").map(n => n[0]).join("")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-ink" style={{ fontFamily: "var(--font-inter)" }}>{c.name}</p>
                          <p className="text-xs text-faint truncate" style={{ fontFamily: "var(--font-inter)" }}>{c.skills}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 bg-border rounded-full overflow-hidden">
                            <div className="h-full bg-info rounded-full" style={{ width: `${c.score}%` }} />
                          </div>
                          <span className="font-data text-xs font-medium text-ink">{c.score}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
