"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { Menu, X, Sparkles } from "lucide-react"
import { useUser, UserButton } from "@clerk/nextjs"
import { motion, AnimatePresence } from "framer-motion"

const navItems = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
]

export function MarketingNav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { isSignedIn } = useUser()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-4 md:px-8 pt-3">
      <motion.div
        animate={{
          paddingTop: scrolled ? "0.5rem" : "0.75rem",
          paddingBottom: scrolled ? "0.5rem" : "0.75rem",
        }}
        className={`mx-auto max-w-7xl rounded-xl transition-all duration-300 bg-surface border border-border ${
          scrolled ? "shadow-[0_1px_2px_rgba(10,10,10,0.04)]" : ""
        }`}
      >
        <div className="flex items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-info">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-base font-medium text-ink" style={{ fontFamily: "var(--font-inter)" }}>
              RecruitIQ
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-2 text-sm text-muted hover:text-ink transition-colors rounded-[6px] hover:bg-[#F9FAFB]"
                style={{ fontFamily: "var(--font-inter)" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            {isSignedIn ? (
              <>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center rounded-[8px] border border-border bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-[#F3F4F6] transition-all"
                  style={{ fontFamily: "var(--font-inter)" }}
                >
                  Dashboard
                </Link>
                <UserButton />
              </>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="inline-flex items-center justify-center rounded-[8px] px-4 py-2 text-sm font-medium text-muted hover:text-ink transition-colors"
                  style={{ fontFamily: "var(--font-inter)" }}
                >
                  Sign In
                </Link>
                <Link
                  href="/sign-up"
                  className="inline-flex items-center justify-center rounded-[8px] bg-ink px-5 py-2 text-sm font-medium text-white hover:bg-ink-hover transition-all duration-120"
                  style={{ fontFamily: "var(--font-inter)" }}
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden flex h-9 w-9 items-center justify-center rounded-[6px] hover:bg-[#F9FAFB] transition-colors"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scaleY: 0.95 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -10, scaleY: 0.95 }}
            transition={{ duration: 0.2 }}
            className="md:hidden mt-2 rounded-xl border border-border bg-surface overflow-hidden"
          >
            <div className="px-4 py-4 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2.5 text-sm text-muted hover:text-ink rounded-[6px] hover:bg-[#F9FAFB] transition-colors"
                  style={{ fontFamily: "var(--font-inter)" }}
                >
                  {item.label}
                </Link>
              ))}
              <hr className="my-3 border-border" />
              {isSignedIn ? (
                <>
                  <Link
                    href="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2.5 text-sm font-medium text-center rounded-[8px] border border-border bg-surface hover:bg-[#F3F4F6] transition-all"
                    style={{ fontFamily: "var(--font-inter)" }}
                  >
                    Dashboard
                  </Link>
                  <div className="flex justify-center pt-1">
                    <UserButton />
                  </div>
                </>
              ) : (
                <>
                  <Link
                    href="/sign-in"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2.5 text-sm font-medium text-center rounded-[8px] hover:bg-[#F9FAFB] transition-colors"
                    style={{ fontFamily: "var(--font-inter)" }}
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/sign-up"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2.5 text-sm font-medium text-center rounded-[8px] bg-ink text-white hover:bg-ink-hover transition-all duration-120"
                    style={{ fontFamily: "var(--font-inter)" }}
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
