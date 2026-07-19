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
        <div className="inline-flex items-center gap-1.5 rounded-full bg-[#F6F6F4] px-3 py-1 text-xs font-medium text-[#6B7280] mb-5">
          <span className="flex h-1.5 w-1.5 rounded-full bg-[#111111]" />
          {label}
        </div>
      )}
      <h2 className="text-3xl md:text-4xl font-medium text-[#111111] tracking-tight">
        {title}
        {highlight && (
          <span className="text-[#111111]/60"> {highlight}</span>
        )}
      </h2>
      {description && (
        <p className="mt-4 text-base md:text-lg text-[#6B7280] leading-relaxed max-w-2xl mx-auto">
          {description}
        </p>
      )}
    </motion.div>
  )
}
