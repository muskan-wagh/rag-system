"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { Menu, X } from "lucide-react"
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
    <header className="fixed top-0 left-0 right-0 z-50 px-4 md:px-6 pt-3">
      <motion.div
        animate={{
          paddingTop: scrolled ? "0.5rem" : "0.75rem",
          paddingBottom: scrolled ? "0.5rem" : "0.75rem",
        }}
        className={`mx-auto max-w-7xl rounded-2xl transition-all duration-300 ${
          scrolled ? "glass-strong shadow-sm" : "glass"
        }`}
      >
        <div className="flex items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-emerald-500 shadow-md shadow-primary/20">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-base font-semibold text-foreground tracking-tight">
              Recruit<span className="text-primary">IQ</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3.5 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-white/40"
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
                  className="inline-flex items-center justify-center rounded-lg border border-border/60 bg-white/50 px-4 py-2 text-sm font-medium text-foreground hover:bg-white/80 transition-all backdrop-blur-sm"
                >
                  Dashboard
                </Link>
                <UserButton />
              </>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/sign-up"
                  className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-primary to-emerald-500 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25 transition-all duration-300"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/40 transition-colors"
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
            className="md:hidden mt-2 rounded-2xl glass-strong shadow-lg overflow-hidden"
          >
            <div className="px-4 py-4 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-white/40 transition-colors"
                >
                  {item.label}
                </Link>
              ))}
              <hr className="my-3 border-border/60" />
              {isSignedIn ? (
                <>
                  <Link
                    href="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2.5 text-sm font-medium text-center rounded-lg border border-border/60 bg-white/50 hover:bg-white/80 transition-all"
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
                    className="block px-3 py-2.5 text-sm font-medium text-center rounded-lg hover:bg-white/40 transition-colors"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/sign-up"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2.5 text-sm font-medium text-center rounded-xl bg-gradient-to-r from-primary to-emerald-500 text-white shadow-md"
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
