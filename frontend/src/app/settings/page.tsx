"use client"

import { motion } from "framer-motion"
import { Bell, Key, Users, Palette, ChevronRight } from "lucide-react"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const } },
}

const settingsSections = [
  {
    icon: Bell,
    title: "Notifications",
    description: "Configure email and in-app notification preferences.",
    status: "Coming soon",
  },
  {
    icon: Key,
    title: "API Configuration",
    description: "Manage API keys and integrations for your team.",
    status: "Coming soon",
  },
  {
    icon: Users,
    title: "Team",
    description: "Manage team members, roles, and permissions.",
    status: "Coming soon",
  },
  {
    icon: Palette,
    title: "Appearance",
    description: "Customize your RecruitIQ experience.",
    status: "Coming soon",
  },
]

export default function SettingsPage() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="pt-6 space-y-8"
    >
      <motion.div variants={itemVariants}>
        <h1 className="text-lg font-medium text-text-primary" style={{ letterSpacing: "-0.01em", fontFamily: "var(--font-inter)" }}>Settings</h1>
        <p className="text-sm text-text-secondary mt-1" style={{ fontFamily: "var(--font-inter)" }}>Manage your account and application settings</p>
      </motion.div>

      <motion.div variants={itemVariants} className="grid gap-4 max-w-2xl">
        {settingsSections.map((section) => (
          <div key={section.title}
            className="bg-card border border-border rounded-[10px] hover:border-border-strong transition-all duration-120 p-6"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-surface-secondary flex items-center justify-center">
                  <section.icon className="h-4 w-4 text-text-primary" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-text-primary" style={{ fontFamily: "var(--font-inter)" }}>{section.title}</h3>
                  <p className="text-xs text-text-secondary mt-0.5" style={{ fontFamily: "var(--font-inter)" }}>{section.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-text-muted bg-surface-secondary px-[10px] py-[3px] rounded-md" style={{ fontFamily: "var(--font-inter)" }}>{section.status}</span>
                <ChevronRight className="h-4 w-4 text-text-muted" strokeWidth={1.5} />
              </div>
            </div>
          </div>
        ))}
      </motion.div>
    </motion.div>
  )
}
