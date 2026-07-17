"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { Toaster } from "sonner"

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 ml-56">
        <div className="flex-1">{children}</div>
      </main>
      <Toaster position="bottom-right" richColors closeButton />
    </div>
  )
}
