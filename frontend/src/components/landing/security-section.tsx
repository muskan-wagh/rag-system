"use client"

import { motion } from "framer-motion"
import { Shield, Lock, FileSearch, Users, Eye, Server } from "lucide-react"
import { SectionHeader } from "@/components/ui/section-header"
import { GlassCard } from "@/components/ui/glass-card"

const items = [
  { icon: Shield, title: "SOC 2 Compliant", description: "Enterprise-grade security with SOC 2 Type II certification." },
  { icon: Lock, title: "GDPR Ready", description: "Full compliance with GDPR data protection requirements." },
  { icon: Server, title: "Encryption at Rest", description: "AES-256 encryption for all data at rest and in transit." },
  { icon: FileSearch, title: "Audit Logs", description: "Comprehensive audit trails for every action in the system." },
  { icon: Users, title: "Role-Based Access", description: "Granular permissions with RBAC and SSO integration." },
  { icon: Eye, title: "Data Privacy", description: "Your candidate data is never used for training our models." },
]

export function SecuritySection() {
  return (
    <section id="security" className="w-full py-20 md:py-28 relative overflow-hidden bg-gradient-to-b from-background to-primary/[0.02]">
      <div className="absolute inset-0 grid-bg pointer-events-none opacity-20" />
      <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-primary/[0.03] rounded-full blur-3xl" />

      <div className="mx-auto max-w-7xl px-4 md:px-8 relative">
        <SectionHeader
          label="Security"
          title="Enterprise-grade"
          highlight="security"
          description="Your data is protected with industry-leading security standards"
        />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"
        >
          {items.map((item) => (
            <GlassCard key={item.title} className="text-center">
              <div className="flex justify-center mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/10 to-emerald-400/10 border border-primary/5 flex items-center justify-center">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">{item.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
            </GlassCard>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
