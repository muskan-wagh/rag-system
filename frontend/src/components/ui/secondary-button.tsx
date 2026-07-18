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
      whileTap={{ scale: 0.98 }}
      className="inline-block"
    >
      <Link
        href={href}
        className={`inline-flex items-center gap-2 rounded-xl glass-strong px-6 py-3 text-sm font-medium text-foreground hover:bg-white/90 transition-all duration-300 ${className}`}
      >
        {icon && <span className="h-4 w-4">{icon}</span>}
        {children}
      </Link>
    </motion.div>
  )
}
