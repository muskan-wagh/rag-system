"use client"

import Link from "next/link"
import { Bell, Key, Users, Palette, ChevronRight } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"

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
    description: "Customize your HireStack experience.",
    status: "Coming soon",
  },
]

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Manage your account and application settings"
      />

      <div className="grid max-w-2xl gap-3">
        {settingsSections.map((section) => (
          <Link
            key={section.title}
            href="#"
            className="group rounded-lg border border-border bg-surface p-5 transition-all duration-120 hover:border-border-hover"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3.5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-secondary text-muted">
                  <section.icon className="size-4" strokeWidth={1.5} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-[13px] font-medium text-ink">{section.title}</h3>
                  <p className="mt-0.5 truncate text-[12px] text-muted">{section.description}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-md bg-surface-secondary px-2 py-0.5 text-[11px] text-muted">
                  {section.status}
                </span>
                <ChevronRight className="size-4 text-faint transition-transform duration-120 group-hover:translate-x-0.5" strokeWidth={1.5} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}