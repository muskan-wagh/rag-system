"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { Clock, ChevronRight } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { getInitials, ROUTES } from "@/lib/constants"
import type { NeedsReviewItem } from "@/lib/types"

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const } },
}

export function NeedsReviewCard({ items }: { items: NeedsReviewItem[] }) {
  return (
    <motion.div variants={itemVariants}>
      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="text-[18px] font-semibold text-ink" style={{ fontFamily: "var(--font-inter)", letterSpacing: "-0.01em" }}>
            Needs Review
          </h2>
          <p className="text-[13px] text-muted mt-0.5" style={{ fontFamily: "var(--font-inter)" }}>
            Candidates waiting &gt;48h
          </p>
        </div>
        {items.length > 0 && (
          <Link href={`${ROUTES.candidates}?status=applied`} className="text-[13px] font-medium text-muted hover:text-ink transition-colors duration-120 inline-flex items-center gap-1" style={{ fontFamily: "var(--font-inter)" }}>
            View all
            <ChevronRight className="size-3.5" strokeWidth={1.5} />
          </Link>
        )}
      </div>
      {items.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl px-6 flex items-center justify-center min-h-[180px]">
          <div className="flex flex-col items-center text-center">
            <div className="h-9 w-9 rounded-[10px] bg-[#F3F4F6] flex items-center justify-center mb-2.5">
              <Clock className="h-4 w-4 text-muted" strokeWidth={1.5} />
            </div>
            <p className="text-[13px] font-medium text-ink" style={{ fontFamily: "var(--font-inter)" }}>All caught up!</p>
            <p className="text-[12px] text-muted mt-0.5" style={{ fontFamily: "var(--font-inter)" }}>No candidates require review right now.</p>
          </div>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl p-5 space-y-2">
          {items.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <Link href={`${ROUTES.candidates}/${item.id}`}>
                <div className="flex items-center gap-3 px-1 py-2 rounded-[8px] hover:bg-[#F9FAFB] transition-all duration-120">
                  <Avatar className="size-9 shrink-0">
                    <AvatarFallback className="text-[12px] font-medium bg-[#E5E7EB] text-muted" style={{ fontFamily: "var(--font-inter)" }}>
                      {getInitials(item.full_name ?? undefined)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-ink truncate" style={{ fontFamily: "var(--font-inter)" }}>
                      {item.full_name || "Unknown"}
                    </p>
                    <p className="text-[12px] text-muted truncate mt-0.5" style={{ fontFamily: "var(--font-inter)" }}>
                      {item.current_title || "No title"}
                      {item.current_title && item.current_company ? " · " : ""}
                      {item.current_company || ""}
                    </p>
                  </div>
                  <span className="font-data text-[12px] text-faint shrink-0">
                    {item.days_since_applied}d
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
