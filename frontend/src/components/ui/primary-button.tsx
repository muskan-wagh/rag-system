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
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      className="inline-block"
    >
      <Link
        href={href}
        className={`inline-flex items-center gap-2 rounded-full bg-[#111111] px-5 py-2.5 text-sm font-medium text-white transition-all duration-200 ${className}`}
      >
        {icon && <span className="h-4 w-4">{icon}</span>}
        {children}
      </Link>
    </motion.div>
  )
}
