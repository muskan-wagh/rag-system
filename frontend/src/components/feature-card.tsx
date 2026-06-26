"use client"

import { motion } from "framer-motion"
import type { LucideIcon } from "lucide-react"
import { ArrowRight } from "lucide-react"

interface FeatureCardProps {
  icon: LucideIcon
  title: string
  description: string
  benefits: string[]
  index: number
}

export function FeatureCard({ icon: Icon, title, description, benefits, index }: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      whileHover={{ y: -4 }}
      className="group relative card-hover"
    >
      <div className="relative bg-white rounded-2xl p-6 border border-border card-hover h-full flex flex-col">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary shadow-sm">
          <Icon className="h-5 w-5 text-white" />
        </div>
        <h3 className="text-base font-medium text-foreground mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">{description}</p>
        <ul className="space-y-1.5 mb-4 flex-1">
          {benefits.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2 text-xs text-muted-foreground">
              <div className="h-1 w-1 rounded-full bg-primary/40 mt-1.5 shrink-0" />
              {benefit}
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
          Learn more <ArrowRight className="h-3 w-3" />
        </div>
      </div>
    </motion.div>
  )
}
