"use client"

import { useRef } from "react"
import { motion, useInView } from "framer-motion"
import { SectionHeader } from "@/components/ui/section-header"

const metrics = [
  { value: 98, suffix: "%", label: "Resume Parsing Accuracy", sublabel: "Industry-leading AI extraction" },
  { value: 50, prefix: "50", suffix: "K+", label: "Candidates Processed", sublabel: "And counting every day" },
  { value: 85, suffix: "%", label: "Time Saved", sublabel: "In candidate screening" },
  { value: 120, suffix: "+", label: "Hiring Teams", sublabel: "Trust RecruitIQ globally" },
]

function Counter({ value, suffix, prefix }: { value: number; suffix?: string; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-40px" })

  return (
    <span ref={ref} className="font-data text-4xl md:text-5xl font-medium text-ink">
      {isInView ? (
        <motion.span
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {prefix || ""}
          {value}
          {suffix || ""}
        </motion.span>
      ) : (
        "0"
      )}
    </span>
  )
}

export function MetricsSection() {
  return (
    <section className="w-full py-20 md:py-28 relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 md:px-8 relative">
        <SectionHeader
          title="RecruitIQ by the"
          highlight="numbers"
          description="Trusted by hiring teams worldwide to make better hiring decisions faster"
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {metrics.map((metric, i) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
            >
              <div className="rounded-xl p-6 text-center bg-surface border border-border hover:border-border-hover transition-all duration-120">
                <div className="mb-2">
                  <Counter value={metric.value} suffix={metric.suffix} prefix={metric.prefix} />
                </div>
                <p className="text-sm font-medium text-ink" style={{ fontFamily: "var(--font-inter)" }}>{metric.label}</p>
                <p className="text-xs text-faint mt-1" style={{ fontFamily: "var(--font-inter)" }}>{metric.sublabel}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
