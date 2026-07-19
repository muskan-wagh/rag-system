"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { TopNav } from "@/components/top-nav"

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <AppSidebar />
      <div className="pl-[268px]">
        <TopNav />
        <main className="px-12 pb-12" style={{ maxWidth: "1600px" }}>
          {children}
        </main>
      </div>
    </div>
  )
}
