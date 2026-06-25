"use client"

import { motion } from "framer-motion"

const stats = [
  { label: "Candidates Indexed", value: "10K+" },
  { label: "Match Accuracy", value: "95%" },
  { label: "Faster Screening", value: "3x" },
  { label: "Skills Detected", value: "500+" },
]

export function AnalyticsSection() {
  return (
    <section className="w-full py-20 md:py-28">
      <div className="container px-4 md:px-6 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-2xl md:text-3xl font-semibold text-white mb-3">
            Built for <span className="text-gradient">modern recruiting</span>
          </h2>
          <p className="text-white/50 max-w-xl mx-auto text-sm">
            AI-powered matching that understands context, experience, and cultural fit
          </p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass rounded-2xl p-6 text-center ring-1 ring-white/[0.06]"
            >
              <div className="text-3xl md:text-4xl font-bold text-gradient mb-1">{stat.value}</div>
              <div className="text-xs text-white/50">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-12 glass rounded-2xl p-6 ring-1 ring-white/[0.06] overflow-hidden"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-white">Match Score Distribution</h3>
            <span className="text-xs text-white/40">Last 30 days</span>
          </div>
          <div className="space-y-3">
            {[
              { label: "Skill Match", value: 92, color: "from-purple-600 to-purple-400" },
              { label: "Experience Match", value: 85, color: "from-blue-600 to-blue-400" },
              { label: "Education Match", value: 78, color: "from-cyan-600 to-cyan-400" },
              { label: "Overall Fit", value: 88, color: "from-purple-500 to-blue-500" },
            ].map((bar) => (
              <div key={bar.label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-white/60">{bar.label}</span>
                  <span className="text-white/80">{bar.value}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${bar.value}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, delay: 0.5 + Math.random() * 0.3 }}
                    className={`h-full rounded-full bg-gradient-to-r ${bar.color}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
