"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { AppSidebar, SidebarContent } from "@/components/app-sidebar"
import { TopNav } from "@/components/top-nav"

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const [prevPathname, setPrevPathname] = useState(pathname)
  if (prevPathname !== pathname) {
    setPrevPathname(pathname)
    setMobileOpen(false)
  }

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [mobileOpen])

  return (
    <div className="min-h-[100vh] bg-canvas">
      <AppSidebar />

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40 bg-black/30 lg:hidden"
              onClick={() => setMobileOpen(false)}
              aria-hidden
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              className="fixed bottom-2 left-2 top-2 z-50 w-[264px] overflow-hidden rounded-xl border border-border bg-surface lg:hidden"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
            >
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="min-w-0 lg:pl-[228px]">
        <div className="mx-auto w-full min-w-0 max-w-[1200px] px-3 sm:px-5 lg:px-6">
          <TopNav onOpenMobile={() => setMobileOpen(true)} />
          <main className="overflow-x-clip pb-10 pt-1 sm:pt-2">{children}</main>
        </div>
      </div>
    </div>
  )
}
