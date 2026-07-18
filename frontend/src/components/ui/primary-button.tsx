"use client"

import { motion } from "framer-motion"
import Link from "next/link"

interface PrimaryButtonProps {
  href: string
  children: React.ReactNode
  className?: string
  icon?: React.ReactNode
}

export function PrimaryButton({ href, children, className = "", icon }: PrimaryButtonProps) {
  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: "0 8px 30px rgba(13, 148, 136, 0.25)" }}
      whileTap={{ scale: 0.98 }}
      className="inline-block"
    >
      <Link
        href={href}
        className={`inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-emerald-500 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25 transition-shadow duration-300 ${className}`}
      >
        {icon && <span className="h-4 w-4">{icon}</span>}
        {children}
      </Link>
    </motion.div>
  )
}
