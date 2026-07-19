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
  BarChart3,
  Settings,
  LogOut,
  Sparkles,
  Brain,
} from "lucide-react"

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/candidates", label: "Candidates", icon: Users },
  { href: "/candidates/search", label: "Search", icon: Search },
  { href: "/compare", label: "Compare", icon: GitCompare },
  { href: "/interview", label: "Interviews", icon: Calendar },
]

const secondaryItems = [
  { href: "/analytics", label: "Analytics", icon: BarChart3, disabled: true },
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
    <aside className="fixed left-4 top-4 bottom-4 z-40 flex flex-col bg-white rounded-[28px] shadow-[0_12px_40px_rgba(0,0,0,0.06)] border border-[#ECECEC]" style={{ width: "220px" }}>
      <div className="flex items-center gap-3 px-6 pt-6 pb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#111111]">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <span className="text-base font-medium tracking-tight text-[#111111]">
          Recruit<span className="font-medium">IQ</span>
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {navItems.map((item) => {
          const active = isActive(item.href)
          return (
            <Link key={item.href} href={item.href} className="relative block">
              <div
                className={cn(
                  "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  active
                    ? "text-[#111111] bg-[#F6F6F4]"
                    : "text-[#6B7280] hover:text-[#111111] hover:bg-[#F6F6F4]/50"
                )}
              >
                <item.icon className="h-4 w-4" strokeWidth={active ? 2 : 1.5} />
                {item.label}
              </div>
            </Link>
          )
        })}

        <div className="pt-4 pb-2">
          <div className="px-3 pb-2">
            <p className="text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest">AI Tools</p>
          </div>
          <Link href="/ai-matching" className="relative block">
            <div className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 text-[#6B7280] hover:text-[#111111] hover:bg-[#F6F6F4]/50",
              pathname.startsWith("/ai-matching") && "text-[#111111] bg-[#F6F6F4]"
            )}>
              <Brain className="h-4 w-4" strokeWidth={1.5} />
              AI Matching
            </div>
          </Link>
        </div>

        {secondaryItems.map((item) => {
          if (item.disabled) return null
          const active = isActive(item.href)
          return (
            <Link key={item.href} href={item.href} className="relative block">
              <div
                className={cn(
                  "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  active
                    ? "text-[#111111] bg-[#F6F6F4]"
                    : "text-[#6B7280] hover:text-[#111111] hover:bg-[#F6F6F4]/50"
                )}
              >
                <item.icon className="h-4 w-4" strokeWidth={active ? 2 : 1.5} />
                {item.label}
              </div>
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-[#ECECEC] px-3 py-4 space-y-1">
        <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[#F6F6F4]/50 transition-colors cursor-pointer" onClick={() => router.push("/settings")}>
          <UserButton
            appearance={{
              elements: {
                avatarBox: "h-7 w-7 rounded-full",
              },
            }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[#111111] truncate">Account</p>
            <p className="text-[10px] text-[#A3A3A3] truncate">Settings & Profile</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ redirectUrl: "/" })}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-[#A3A3A3] hover:text-[#111111] hover:bg-[#F6F6F4]/50 transition-all duration-200"
        >
          <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
