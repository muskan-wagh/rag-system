"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { Layers, Users, TrendingUp, ChevronRight } from "lucide-react"
import type { TopTalentPool } from "@/lib/types"

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const } },
}

export function TalentPoolsSummary({ items }: { items: TopTalentPool[] }) {
  if (items.length === 0) return null
  return (
    <motion.div variants={itemVariants}>
      <div className="flex items-end justify-between mb-5">
        <div>
          <h2 className="text-[20px] font-medium text-ink" style={{ fontFamily: "var(--font-inter)", letterSpacing: "-0.01em" }}>
            Top Talent Pools
          </h2>
          <p className="text-sm text-muted mt-1" style={{ fontFamily: "var(--font-inter)" }}>
            Your curated candidate collections
          </p>
        </div>
        <Link href="/pools" className="text-sm font-medium text-muted hover:text-ink transition-colors duration-120 inline-flex items-center gap-1" style={{ fontFamily: "var(--font-inter)" }}>
          View all
          <ChevronRight className="size-4" strokeWidth={1.5} />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {items.map((pool, i) => (
          <motion.div
            key={pool.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <Link href={`/pools/${pool.id}`}>
              <div className="bg-surface border border-border rounded-xl hover:border-border-hover transition-all duration-120 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="size-8 rounded-[10px] bg-[#F3F4F6] flex items-center justify-center">
                    <Users className="size-4 text-muted" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate" style={{ fontFamily: "var(--font-inter)" }}>{pool.name}</p>
                    <p className="text-xs text-muted" style={{ fontFamily: "var(--font-inter)" }}>
                      <span className="font-data">{pool.candidate_count}</span> candidate{pool.candidate_count !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <TrendingUp className="size-4 text-success" strokeWidth={1.5} />
                  <span className="font-data text-sm font-medium text-ink">{pool.average_score}%</span>
                </div>
                <div className="mt-3 h-[3px] bg-[#E2E2E0] rounded-full overflow-hidden">
                  <div className="h-full bg-info rounded-full transition-all duration-500" style={{ width: `${pool.average_score}%` }} />
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
