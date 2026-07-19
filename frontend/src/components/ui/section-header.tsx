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
      className={className}
    >
      {label && (
        <div className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#F3F4F6] px-3 py-1 text-xs font-medium text-muted mb-5" style={{ fontFamily: "var(--font-inter)" }}>
          <span className="flex h-1.5 w-1.5 rounded-full bg-info" />
          {label}
        </div>
      )}
      <h2 className="text-3xl md:text-4xl font-medium text-ink tracking-tight" style={{ letterSpacing: "-0.02em", fontFamily: "var(--font-inter)" }}>
        {title}
        {highlight && (
          <span className="text-muted"> {highlight}</span>
        )}
      </h2>
      {description && (
        <p className="mt-4 text-base md:text-lg text-muted leading-relaxed max-w-2xl mx-auto" style={{ fontFamily: "var(--font-inter)" }}>
          {description}
        </p>
      )}
    </motion.div>
  )
}
