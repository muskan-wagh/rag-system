"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet"
import { Menu, Search, GitCompare, Home, BookOpen, LayoutDashboard, Users } from "lucide-react"
import { ROUTES } from "@/lib/constants"
import { useState } from "react"

const navItems = [
  { href: ROUTES.home, label: "Home", icon: Home },
  { href: ROUTES.dashboard, label: "Dashboard", icon: LayoutDashboard },
  { href: ROUTES.candidates, label: "Candidates", icon: Users },
  { href: ROUTES.candidateSearch, label: "Search", icon: Search },
  { href: ROUTES.compare, label: "Compare", icon: GitCompare },
  { href: ROUTES.howItWorks, label: "How It Works", icon: BookOpen },
]

export function NavBar() {
  const pathname = usePathname()
  const [sheetOpen, setSheetOpen] = useState(false)
  const isActive = (href: string) => {
    if (href === ROUTES.home) return pathname === href
    if (href === ROUTES.candidateSearch) return pathname === href || pathname.startsWith(ROUTES.candidateSearch + "/")
    return pathname.startsWith(href)
  }

  return (
    <header className="sticky top-0 z-50 w-full bg-white/70 backdrop-blur-xl border-b border-[rgba(0,0,0,0.04)]">
      <div className="flex h-16 items-center px-4 md:px-6 max-w-7xl mx-auto">
        <Link href={ROUTES.home} className="flex items-center gap-2.5 mr-10">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-sm">
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
          {navItems.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                {active && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute inset-0 bg-primary/5 rounded-lg"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <item.icon className="h-4 w-4 relative z-10" />
                <span className="relative z-10">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="flex-1" />

        <div className="hidden md:flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            Sign In
          </Button>
          <Button
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm text-sm px-5"
          >
            Get Started
          </Button>
        </div>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger render={
            <Button variant="ghost" size="icon" className="md:hidden -mr-2">
              <Menu className="h-5 w-5" />
            </Button>
          } />
          <SheetContent side="right" className="bg-white/90 backdrop-blur-xl border-l border-border">
            <div className="flex flex-col gap-1 mt-8">
              {navItems.map((item) => {
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSheetOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                      active
                        ? "bg-primary/5 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                )
              })}
              <hr className="my-4 border-border" />
              <Button variant="ghost" size="sm" className="justify-start text-muted-foreground">
                Sign In
              </Button>
              <Button
                size="sm"
                className="mt-1 bg-primary text-primary-foreground"
              >
                Get Started
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
