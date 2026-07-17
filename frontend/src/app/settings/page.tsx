"use client"

import { Settings } from "lucide-react"

export default function SettingsPage() {
  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary shadow-sm">
          <Settings className="h-3.5 w-3.5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-foreground">Settings</h1>
          <p className="text-xs text-muted-foreground">
            Manage your account and application settings
          </p>
        </div>
      </div>

      <div className="grid gap-6 max-w-2xl">
        <div className="bg-white rounded-xl border border-border p-6">
          <h3 className="text-sm font-semibold text-foreground mb-1">Notifications</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Configure email and in-app notification preferences.
          </p>
          <div className="text-xs text-muted-foreground">
            Notification settings will be available in a future update.
          </div>
        </div>

        <div className="bg-white rounded-xl border border-border p-6">
          <h3 className="text-sm font-semibold text-foreground mb-1">API Configuration</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Manage API keys and integrations.
          </p>
          <div className="text-xs text-muted-foreground">
            API settings will be available in a future update.
          </div>
        </div>

        <div className="bg-white rounded-xl border border-border p-6">
          <h3 className="text-sm font-semibold text-foreground mb-1">Team</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Manage team members and permissions.
          </p>
          <div className="text-xs text-muted-foreground">
            Team management will be available in a future update.
          </div>
        </div>
      </div>
    </div>
  )
}
