"use client"

import { motion } from "framer-motion"

interface AnimatedGradientProps {
  className?: string
  colors?: string[]
}

export function AnimatedGradient({ className = "", colors }: AnimatedGradientProps) {
  return (
    <motion.div
      className={`absolute pointer-events-none ${className}`}
      animate={{
        background: colors
          ? `radial-gradient(circle at 50% 50%, ${colors.join(", ")})`
          : "radial-gradient(circle at 50% 50%, rgba(13, 148, 136, 0.08), rgba(16, 185, 129, 0.04), transparent 70%)",
      }}
      transition={{ duration: 4, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" }}
    />
  )
}
