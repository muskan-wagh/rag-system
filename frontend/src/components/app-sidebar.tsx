"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth, UserButton } from "@clerk/nextjs"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Users,
  Search,
  GitCompare,
  Calendar,
  History,
  Settings,
  LogOut,
  Sparkles,
} from "lucide-react"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/candidates", label: "Candidates", icon: Users },
  { href: "/candidates/search", label: "Search", icon: Search },
  { href: "/compare", label: "Compare", icon: GitCompare },
  { href: "/interview", label: "Interviews", icon: Calendar },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { signOut } = useAuth()
  const router = useRouter()

  function isActive(href: string): boolean {
    if (href === "/dashboard") return pathname === "/dashboard"
    if (href === "/candidates/search") return pathname.startsWith("/candidates/search")
    if (href === "/candidates") return pathname === "/candidates"
    return pathname.startsWith(href)
  }

  return (
    <aside className="fixed left-3 top-3 bottom-3 z-40 flex w-56 flex-col rounded-2xl glass-strong border border-white/50 shadow-lg shadow-black/[0.03]">
      <div className="flex h-14 items-center gap-2.5 px-5 border-b border-border/40">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary shadow-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <span className="text-sm font-semibold text-foreground tracking-tight">
          Recruit<span className="text-primary">IQ</span>
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {navItems.map((item) => {
          const active = isActive(item.href)
          return (
            <Link key={item.href} href={item.href} className="relative block">
              {active && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-lg bg-primary/5 border border-primary/5"
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                />
              )}
              <div
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/40"
                )}
              >
                <item.icon className="h-4 w-4" strokeWidth={1.5} />
                {item.label}
              </div>
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-border/40 p-3 space-y-2">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-white/40 transition-colors cursor-pointer" onClick={() => router.push("/settings")}>
          <UserButton
            appearance={{
              elements: {
                avatarBox: "h-7 w-7",
              },
            }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">Account</p>
            <p className="text-[10px] text-muted-foreground truncate">Settings & Profile</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ redirectUrl: "/" })}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/40 transition-colors"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.5} />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
