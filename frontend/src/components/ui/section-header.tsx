"use client"

import { motion } from "framer-motion"

interface SectionHeaderProps {
  label?: string
  title: string
  highlight?: string
  description?: string
  className?: string
}

export function SectionHeader({ label, title, highlight, description, className = "" }: SectionHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      className={`text-center max-w-2xl mx-auto mb-16 ${className}`}
    >
      {label && (
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-white/60 backdrop-blur-sm px-3.5 py-1 text-xs font-medium text-muted-foreground shadow-sm mb-5">
          <span className="flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse-glow" />
          {label}
        </div>
      )}
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
        {title}
        {highlight && (
          <span className="text-gradient bg-gradient-to-r from-primary to-emerald-400"> {highlight}</span>
        )}
      </h2>
      {description && (
        <p className="mt-4 text-base md:text-lg text-muted-foreground leading-relaxed">
          {description}
        </p>
      )}
    </motion.div>
  )
}
