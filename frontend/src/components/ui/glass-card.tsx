"use client"

import { motion } from "framer-motion"

interface GlassCardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  glow?: boolean
}

export function GlassCard({ children, className = "", hover = true, glow = false }: GlassCardProps) {
  return (
    <motion.div
      whileHover={hover ? { y: -6, boxShadow: "0 20px 40px rgba(0,0,0,0.06), 0 8px 16px rgba(0,0,0,0.04)" } : undefined}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className={`glass-card rounded-2xl p-6 transition-shadow duration-300 ${glow ? "animate-border-glow" : ""} ${className}`}
    >
      {children}
    </motion.div>
  )
}
