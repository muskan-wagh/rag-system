"use client"

import { AppSidebar } from "@/components/app-sidebar"

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-background via-background to-primary/[0.02]">
      <AppSidebar />
      <main className="flex-1 ml-60">
        <div className="min-h-screen">{children}</div>
      </main>
    </div>
  )
}
