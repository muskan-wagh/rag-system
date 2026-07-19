"use client"

import { motion } from "framer-motion"
import { Shield, Lock, FileSearch, Users, Eye, Server } from "lucide-react"
import { SectionHeader } from "@/components/ui/section-header"

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
    <section id="security" className="w-full py-20 md:py-28 relative overflow-hidden">
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
            <div key={item.title} className="rounded-xl border border-border bg-surface p-6 text-center hover:border-border-hover transition-all duration-120">
              <div className="flex justify-center mb-3">
                <div className="w-10 h-10 rounded-[8px] bg-info flex items-center justify-center">
                  <item.icon className="h-5 w-5 text-white" />
                </div>
              </div>
              <h3 className="text-sm font-medium text-ink mb-1" style={{ fontFamily: "var(--font-inter)" }}>{item.title}</h3>
              <p className="text-xs text-muted leading-relaxed" style={{ fontFamily: "var(--font-inter)" }}>{item.description}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
