"use client"

import { motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"
import { SectionLines } from "@/components/landing/hero-stage"

/**
 * Consistent marketing band: the section's own running hairlines sit behind the
 * content, the tint stays translucent so the page stage shows through, and the
 * block reveals on scroll.
 */
export function MarketingSection({
  id,
  children,
  className,
  bordered = true,
  tone = "canvas",
}: {
  id?: string
  children: React.ReactNode
  className?: string
  bordered?: boolean
  tone?: "canvas" | "surface" | "none"
}) {
  const reduced = useReducedMotion()

  return (
    <section
      id={id}
      className={cn(
        "relative scroll-mt-24 overflow-hidden",
        bordered && "border-t border-white/[0.07]",
        tone === "surface" && "bg-white/[0.012]",
        className,
      )}
    >
      <SectionLines />

      <motion.div
        initial={reduced ? undefined : { opacity: 0, y: 26 }}
        whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-90px" }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="container-page section-y relative"
      >
        {children}
      </motion.div>
    </section>
  )
}