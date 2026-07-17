"use client"

import { AppSidebar } from "@/components/app-sidebar"

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 ml-56">
        <div className="flex-1">{children}</div>
      </main>
    </div>
  )
}
