"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { Menu, X, ArrowRight } from "lucide-react"
import { useUser } from "@clerk/nextjs"
import { cn } from "@/lib/utils"

export const MARKETING_NAV = [
  { href: "/#product", label: "Product" },
  { href: "/#pipeline", label: "Pipeline" },
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/performance", label: "Performance" },
] as const

export function MarketingNav() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()
  const { isSignedIn } = useUser()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Close the mobile menu when the route changes. Adjusting state during
  // render (the documented React pattern) avoids an extra effect pass.
  const [lastPath, setLastPath] = useState(pathname)
  if (lastPath !== pathname) {
    setLastPath(pathname)
    if (open) setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  const isActive = (href: string) =>
    href.startsWith("/#") ? false : pathname === href || pathname.startsWith(`${href}/`)

return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      <motion.nav
        aria-label="Primary"
        animate={{ paddingTop: scrolled ? 8 : 12, paddingBottom: scrolled ? 8 : 12 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-full px-3 transition-colors duration-300 sm:px-4",
          scrolled
            ? "border border-white/10 bg-[#080908]/85 shadow-[0_8px_30px_-8px_rgba(0,0,0,0.8)] backdrop-blur-xl"
            : "border border-white/[0.07] bg-white/[0.04] backdrop-blur-md",
        )}
      >
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2.5 rounded-full py-1 pl-1 pr-2 text-white"
          aria-label="HireStack home"
        >
          <span className="relative flex size-8 items-center justify-center">
            <span className="absolute inset-0 rounded-[10px] bg-[#CBE2D2]/10 ring-1 ring-inset ring-[#CBE2D2]/25 transition-colors duration-300 group-hover:bg-[#CBE2D2]/15" />
            <svg
              viewBox="0 0 16 16"
              className="relative size-3.5 text-[#CBE2D2]"
              fill="currentColor"
              aria-hidden
            >
              <rect x="1" y="1.75" width="14" height="3" rx="1.5" />
              <rect x="3.5" y="6.5" width="9" height="3" rx="1.5" opacity="0.66" />
              <rect x="6" y="11.25" width="4" height="3" rx="1.5" opacity="0.38" />
            </svg>
          </span>
          <span className="hidden text-[14.5px] font-medium tracking-[-0.01em] sm:block">
            HireStack
          </span>
        </Link>

        <div className="hidden items-center gap-0.5 lg:flex">
          {MARKETING_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-[13px] transition-colors duration-200",
                isActive(item.href)
                  ? "bg-white/[0.10] font-medium text-white"
                  : "text-white/60 hover:bg-white/[0.06] hover:text-white",
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isSignedIn ? (
            <Link
              href="/dashboard"
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-[13.5px] font-medium text-[#0A0A0A] transition-all duration-300 hover:bg-[#CBE2D2]"
            >
              Open app
              <ArrowRight className="size-3.5" />
            </Link>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="hidden rounded-full px-3 py-1.5 text-[13px] text-white/60 transition-colors hover:text-white sm:block"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-[13.5px] font-medium text-[#0A0A0A] transition-all duration-300 hover:bg-[#CBE2D2]"
              >
                Get started
                <ArrowRight className="size-3.5" />
              </Link>
            </>
          )}

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            className="flex size-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/[0.08] lg:hidden"
          >
            {open ? <X className="size-4.5" /> : <Menu className="size-4.5" />}
          </button>
        </div>
      </motion.nav>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] lg:hidden"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-x-3 top-[4.5rem] z-50 overflow-hidden rounded-2xl border border-white/10 bg-[#080908]/95 p-2 shadow-2xl backdrop-blur-xl lg:hidden"
            >
              <ul className="flex flex-col">
                {MARKETING_NAV.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="block rounded-lg px-3 py-2.5 text-[14px] text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
              {!isSignedIn && (
                <div className="mt-2 border-t border-white/10 pt-2">
                  <Link
                    href="/sign-in"
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-3 py-2.5 text-center text-[14px] font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
                  >
                    Sign in
                  </Link>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  )
}
