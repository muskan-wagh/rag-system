"use client"

import { MarketingNav } from "@/components/marketing-nav"
import { MarketingFooter } from "@/components/marketing-footer"
import { Toaster } from "sonner"

export function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MarketingNav />
      <main className="flex-1 pt-16">{children}</main>
      <MarketingFooter />
      <Toaster position="bottom-right" richColors closeButton />
    </>
  )
}
