"use client"

import { motion } from "framer-motion"
import { Building2, Briefcase, Cloud, Globe, Layers, Shield } from "lucide-react"

const companies = [
  { name: "TechCorp", icon: Building2 },
  { name: "InnovateInc", icon: Briefcase },
  { name: "CloudBase", icon: Cloud },
  { name: "GlobalTech", icon: Globe },
  { name: "StackLabs", icon: Layers },
  { name: "SecureIO", icon: Shield },
]

export function LogoWall() {
  return (
    <section className="w-full py-12 md:py-16 border-y border-border bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <p className="text-xs text-center text-muted-foreground uppercase tracking-wider font-medium mb-8">
          Trusted by leading recruitment teams
        </p>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-8 md:gap-12 items-center">
          {companies.map((company, i) => (
            <motion.div
              key={company.name}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="flex flex-col items-center gap-2 text-muted-foreground/40"
            >
              <company.icon className="h-6 w-6" />
              <span className="text-xs font-medium text-muted-foreground/60">
                {company.name}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
