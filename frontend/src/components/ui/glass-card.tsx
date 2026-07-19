"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface GlassCardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
}

export function GlassCard({ children, className = "", hover = true }: GlassCardProps) {
  return (
    <motion.div
      whileHover={hover ? { y: -4 } : undefined}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className={cn(
        "bg-[rgba(255,255,255,0.7)] backdrop-blur-[20px] rounded-[24px] border border-[rgba(236,236,236,0.5)] transition-all duration-300",
        className
      )}
    >
      {children}
    </motion.div>
  )
}
