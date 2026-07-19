"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { TopNav } from "@/components/top-nav"

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <AppSidebar />
      <div className="pl-[220px]">
        <TopNav />
        <main className="px-8 pb-12">
          {children}
        </main>
      </div>
    </div>
  )
}
