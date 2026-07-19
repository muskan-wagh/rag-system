"use client"

import { motion } from "framer-motion"
import { Bookmark } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const } },
}

export default function SavedSearchesPage() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="pt-6"
    >
      <motion.div variants={itemVariants}>
        <h1 className="text-xl font-medium text-[#111111] tracking-tight">Saved Searches</h1>
        <p className="text-sm text-[#6B7280] mt-1">Your saved candidate search queries</p>
      </motion.div>

      <motion.div variants={itemVariants} className="mt-8">
        <EmptyState
          icon={Bookmark}
          title="No saved searches"
          description="Save your candidate search queries to quickly access them later."
        />
      </motion.div>
    </motion.div>
  )
}
