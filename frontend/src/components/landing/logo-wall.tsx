"use client"

import { Building2, Briefcase, Cloud, Globe, Layers, Shield } from "lucide-react"

const companies = [
  { name: "TechCorp", icon: Building2 },
  { name: "InnovateInc", icon: Briefcase },
  { name: "CloudBase", icon: Cloud },
  { name: "GlobalTech", icon: Globe },
  { name: "StackLabs", icon: Layers },
  { name: "SecureIO", icon: Shield },
  { name: "DataFlow", icon: Building2 },
  { name: "Neural", icon: Layers },
]

export function LogoWall() {
  return (
    <section className="w-full py-16 md:py-20 relative overflow-hidden border-y border-border/40 bg-white/30">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <p className="text-xs text-center text-muted-foreground uppercase tracking-widest font-medium mb-10">
          Trusted by hiring teams across industries
        </p>

        <div className="relative overflow-hidden">
          <div className="flex animate-marquee gap-16 md:gap-20 items-center">
            {[...companies, ...companies].map((company, i) => (
              <div
                key={`${company.name}-${i}`}
                className="flex items-center gap-3 text-muted-foreground/30 hover:text-muted-foreground/50 transition-colors duration-300 shrink-0"
              >
                <company.icon className="h-5 w-5" />
                <span className="text-sm font-medium whitespace-nowrap">{company.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
