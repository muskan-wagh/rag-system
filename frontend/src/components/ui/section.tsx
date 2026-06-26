"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface SectionProps {
  children: React.ReactNode
  className?: string
  title?: string
  description?: string
  align?: "center" | "left"
  id?: string
}

export function Section({ children, className, title, description, align = "center", id }: SectionProps) {
  return (
    <section id={id} className={cn("w-full py-16 md:py-24", className)}>
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        {(title || description) && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            className={cn(
              "mb-12",
              align === "center" && "text-center"
            )}
          >
            {title && (
              <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-3 text-sm text-muted-foreground max-w-xl mx-auto">
                {description}
              </p>
            )}
          </motion.div>
        )}
        {children}
      </div>
    </section>
  )
}
