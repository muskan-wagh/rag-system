"use client"

import { motion } from "framer-motion"
import { Sparkles, Users, Calendar, Briefcase, ArrowUpRight, ArrowRight } from "lucide-react"
import type { QuickAction } from "@/lib/types"

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const } },
}

function getActionIcon(icon: string) {
  switch (icon) {
    case "users": return <Users className="size-4" strokeWidth={1.5} />
    case "calendar": return <Calendar className="size-4" strokeWidth={1.5} />
    case "briefcase": return <Briefcase className="size-4" strokeWidth={1.5} />
    default: return <Sparkles className="size-4" strokeWidth={1.5} />
  }
}

export function QuickActions({ items, onAction }: { items: QuickAction[]; onAction: (action: string) => void }) {
  if (items.length === 0) return null
  return (
    <motion.div variants={itemVariants}>
      <h2 className="text-[18px] font-semibold text-ink mb-3" style={{ fontFamily: "var(--font-inter)", letterSpacing: "-0.01em" }}>
        Quick Actions
      </h2>
      <div className="flex flex-wrap gap-3">
        {items.map((action, i) => {
          const isPrimary = action.priority === "high"
          return (
            <motion.button
              key={action.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05, duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
              onClick={() => onAction(action.action)}
              className={
                isPrimary
                  ? "inline-flex items-center gap-2 px-4 py-2 bg-ink text-white rounded-[10px] text-[13px] font-medium transition-all duration-120 hover:bg-ink-hover active:scale-[0.98]"
                  : "inline-flex items-center gap-2 px-4 py-2 bg-transparent text-ink border border-border rounded-[10px] text-[13px] font-medium transition-all duration-120 hover:bg-[#F3F4F6] active:scale-[0.98]"
              }
              style={{ fontFamily: "var(--font-inter)" }}
            >
              {getActionIcon(action.icon)}
              <span>{action.label}</span>
              {isPrimary
                ? <ArrowRight className="size-3.5" strokeWidth={1.5} />
                : <ArrowUpRight className="size-3.5" strokeWidth={1.5} />
              }
            </motion.button>
          )
        })}
      </div>
    </motion.div>
  )
}
