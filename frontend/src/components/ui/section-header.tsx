"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface SectionHeaderProps {
  /** Small eyebrow above the heading, e.g. "Product". */
  label?: string
  title: React.ReactNode
  description?: React.ReactNode
  align?: "center" | "left"
  className?: string
  /** Extra content rendered under the description (pills, CTAs, links). */
  children?: React.ReactNode
  as?: "h2" | "h3"
}

/**
 * Shared heading block for every marketing section. Keeps the vertical rhythm
 * and the restrained fade-up consistent across the public site.
 */
export function SectionHeader({
  label,
  title,
  description,
  align = "center",
  className,
  children,
  as: Tag = "h2",
}: SectionHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "flex flex-col",
        align === "center" ? "items-center text-center" : "items-start text-left",
        className,
      )}
    >
      {label && (
        <span
          className={cn(
            "mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 backdrop-blur-md",
            "text-[11px] font-medium uppercase tracking-[0.14em] text-white/60",
          )}
        >
          <span className="relative flex size-1.5" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#CBE2D2] opacity-70" />
            <span className="relative inline-flex size-1.5 rounded-full bg-[#CBE2D2]" />
          </span>
          {label}
        </span>
      )}

      <Tag
        className={cn(
          "max-w-3xl text-balance text-[30px] font-medium leading-[1.06] tracking-[-0.035em] text-white sm:text-[40px] lg:text-[48px]",
        )}
      >
        {title}
      </Tag>

      {description && (
        <p
          className={cn(
            "mt-5 max-w-2xl text-pretty text-[15px] leading-relaxed text-white/50 sm:text-[17px]",
          )}
        >
          {description}
        </p>
      )}

      {children && <div className="mt-7">{children}</div>}
    </motion.div>
  )
}
