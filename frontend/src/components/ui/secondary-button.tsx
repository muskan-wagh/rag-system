"use client"

import { motion } from "framer-motion"
import Link from "next/link"

interface SecondaryButtonProps {
  href: string
  children: React.ReactNode
  className?: string
  icon?: React.ReactNode
}

export function SecondaryButton({ href, children, className = "", icon }: SecondaryButtonProps) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      className="inline-block"
    >
      <Link
        href={href}
        className={`inline-flex items-center gap-2 rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-medium text-ink hover:bg-surface-secondary transition-all duration-200 ${className}`}
      >
        {icon && <span className="h-4 w-4">{icon}</span>}
        {children}
      </Link>
    </motion.div>
  )
}
