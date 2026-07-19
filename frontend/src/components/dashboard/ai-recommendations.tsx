"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { getInitials, ROUTES } from "@/lib/constants"
import type { AiRecommendation } from "@/lib/types"

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const } },
}

export function AiRecommendations({ items }: { items: AiRecommendation[] }) {
  if (items.length === 0) return null
  return (
    <motion.div variants={itemVariants}>
      <div className="flex items-end justify-between mb-5">
        <div>
          <h2 className="text-[20px] font-medium text-ink" style={{ fontFamily: "var(--font-inter)", letterSpacing: "-0.01em" }}>
            AI Recommendations
          </h2>
          <p className="text-sm text-muted mt-1" style={{ fontFamily: "var(--font-inter)" }}>
            Top candidates from your pipeline
          </p>
        </div>
        <Link href={ROUTES.candidates} className="text-sm font-medium text-muted hover:text-ink transition-colors duration-120 inline-flex items-center gap-1" style={{ fontFamily: "var(--font-inter)" }}>
          View all
          <ChevronRight className="size-4" strokeWidth={1.5} />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {items.slice(0, 4).map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <Link href={`${ROUTES.candidates}/${item.id}`}>
              <div className="bg-surface border border-border rounded-xl hover:border-border-hover transition-all duration-120 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar className="size-10 shrink-0">
                    <AvatarFallback className="text-sm font-medium bg-[#E5E7EB] text-muted" style={{ fontFamily: "var(--font-inter)" }}>
                      {getInitials(item.full_name ?? undefined)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium text-ink truncate" style={{ fontFamily: "var(--font-inter)" }}>
                      {item.full_name || "Unknown"}
                    </p>
                    <p className="text-[13px] text-muted truncate" style={{ fontFamily: "var(--font-inter)" }}>
                      {item.current_title || ""}
                    </p>
                  </div>
                </div>
                {item.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {item.skills.slice(0, 3).map((skill, j) => (
                      <span key={j} className="inline-flex items-center px-[10px] py-[3px] rounded-[6px] text-xs font-normal bg-[#F3F4F6] text-muted" style={{ fontFamily: "var(--font-inter)" }}>
                        {skill}
                      </span>
                    ))}
                    {item.skills.length > 3 && (
                      <span className="text-xs text-faint font-normal" style={{ fontFamily: "var(--font-inter)" }}>
                        +{item.skills.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
