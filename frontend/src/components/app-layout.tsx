"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { TopNav } from "@/components/top-nav"

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100vh-0.75rem)] bg-canvas">
      <AppSidebar />
      <div className="pl-[240px]">
        <TopNav />
        <main className="px-6 pb-12">
          {children}
        </main>
      </div>
    </div>
  )
}
