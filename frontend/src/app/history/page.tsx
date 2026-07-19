"use client"

import { motion } from "framer-motion"
import { History, Clock } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const } },
}

export default function HistoryPage() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="pt-6"
    >
      <motion.div variants={itemVariants}>
        <h1 className="text-xl font-medium text-[#111111] tracking-tight">History</h1>
        <p className="text-sm text-[#6B7280] mt-1">Your search and activity history</p>
      </motion.div>

      <motion.div variants={itemVariants} className="mt-8">
        <EmptyState
          icon={History}
          title="No history yet"
          description="Your recent candidate searches, comparisons, and activity will appear here."
        />
      </motion.div>
    </motion.div>
  )
}
