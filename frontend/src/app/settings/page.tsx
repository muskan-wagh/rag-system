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
        <h1 className="text-xl font-medium text-[#111111] tracking-tight">Settings</h1>
        <p className="text-sm text-[#6B7280] mt-1">Manage your account and application settings</p>
      </motion.div>

      <motion.div variants={itemVariants} className="grid gap-4 max-w-2xl">
        {settingsSections.map((section) => (
          <div key={section.title}
            className="bg-white rounded-[24px] border border-[#ECECEC] shadow-[0_10px_40px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_60px_rgba(0,0,0,0.08)] transition-all duration-300 p-6"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-[#F6F6F4] flex items-center justify-center">
                  <section.icon className="h-4 w-4 text-[#111111]" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-[#111111]">{section.title}</h3>
                  <p className="text-xs text-[#6B7280] mt-0.5">{section.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#A3A3A3] bg-[#F6F6F4] px-2.5 py-1 rounded-full">{section.status}</span>
                <ChevronRight className="h-4 w-4 text-[#A3A3A3]" strokeWidth={1.5} />
              </div>
            </div>
          </div>
        ))}
      </motion.div>
    </motion.div>
  )
}
