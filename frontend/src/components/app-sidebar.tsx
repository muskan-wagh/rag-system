"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Users,
  Search,
  GitCompare,
  Calendar,
  Settings,
  BarChart3,
  Brain,
  LogOut,
} from "lucide-react"
import { useAuth } from "@clerk/nextjs"

const mainNav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/candidates", label: "Candidates", icon: Users },
  { href: "/candidates/search", label: "Search", icon: Search },
  { href: "/pools", label: "Pools", icon: BarChart3 },
  { href: "/compare", label: "Compare", icon: GitCompare },
  { href: "/interview", label: "Interviews", icon: Calendar },
]

const generalNav = [
  { href: "/search", label: "Saved Searches", icon: Search },
  { href: "/history", label: "History", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { user } = useUser()
  const { signOut } = useAuth()

  function isActive(href: string): boolean {
    if (href === "/dashboard") return pathname === "/dashboard"
    if (href === "/candidates/search") return pathname.startsWith("/candidates/search")
    if (href === "/candidates") return pathname === "/candidates"
    return pathname.startsWith(href)
  }

  return (
    <aside className="fixed left-0 top-0 bottom-0 z-40 flex flex-col bg-surface border-r border-border" style={{ width: 220 }}>
      <div className="px-5 pb-8 pt-6">
        <span className="text-base font-medium text-ink" style={{ fontFamily: "var(--font-inter)", letterSpacing: "-0.01em" }}>
          RecruitIQ
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto">
        <div className="px-3 pb-2 pt-6">
          <p className="px-3 text-[11px] font-medium text-faint uppercase" style={{ letterSpacing: "0.06em", fontFamily: "var(--font-inter)" }}>
            Main
          </p>
        </div>
        <div className="space-y-0.5 px-3">
          {mainNav.map((item) => {
            const active = isActive(item.href)
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-[6px] transition-all duration-120 relative",
                    "h-10 px-3",
                    active
                      ? "bg-[#F3F4F6] text-ink font-medium shadow-[0_1px_2px_rgba(10,10,10,0.04)]"
                      : "text-muted font-normal hover:bg-[#F9FAFB]"
                  )}
                  style={{ fontFamily: "var(--font-inter)" }}
                >
                  {active && <div className="absolute left-[-3px] top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full bg-info" />}
                  <item.icon className="size-[18px]" strokeWidth={active ? 2 : 1.5} style={{ color: active ? "var(--ink)" : "var(--faint)" }} />
                  <span className="text-sm">{item.label}</span>
                </div>
              </Link>
            )
          })}
        </div>

        <div className="px-3 pb-2 pt-6">
          <p className="px-3 text-[11px] font-medium text-faint uppercase" style={{ letterSpacing: "0.06em", fontFamily: "var(--font-inter)" }}>
            AI Tools
          </p>
        </div>
        <div className="space-y-0.5 px-3">
          <Link href="/ai-matching">
            <div
              className={cn(
                "flex items-center gap-3 rounded-[6px] transition-all duration-120 h-10 px-3 relative",
                pathname.startsWith("/ai-matching")
                  ? "bg-[#F3F4F6] text-ink font-medium shadow-[0_1px_2px_rgba(10,10,10,0.04)]"
                  : "text-muted font-normal hover:bg-[#F9FAFB]"
              )}
              style={{ fontFamily: "var(--font-inter)" }}
            >
              {pathname.startsWith("/ai-matching") && <div className="absolute left-[-3px] top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full bg-info" />}
              <Brain className="size-[18px]" strokeWidth={1.5} style={{ color: pathname.startsWith("/ai-matching") ? "var(--ink)" : "var(--faint)" }} />
              <span className="text-sm">AI Matching</span>
            </div>
          </Link>
        </div>

        <div className="px-3 pb-2 pt-6">
          <p className="px-3 text-[11px] font-medium text-faint uppercase" style={{ letterSpacing: "0.06em", fontFamily: "var(--font-inter)" }}>
            General
          </p>
        </div>
        <div className="space-y-0.5 px-3">
          {generalNav.map((item) => {
            const active = isActive(item.href)
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-[6px] transition-all duration-120 h-10 px-3 relative",
                    active
                      ? "bg-[#F3F4F6] text-ink font-medium shadow-[0_1px_2px_rgba(10,10,10,0.04)]"
                      : "text-muted font-normal hover:bg-[#F9FAFB]"
                  )}
                  style={{ fontFamily: "var(--font-inter)" }}
                >
                  {active && <div className="absolute left-[-3px] top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full bg-info" />}
                  <item.icon className="size-[18px]" strokeWidth={active ? 2 : 1.5} style={{ color: active ? "var(--ink)" : "var(--faint)" }} />
                  <span className="text-sm">{item.label}</span>
                </div>
              </Link>
            )
          })}
        </div>
      </nav>

      <div className="border-t border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-full bg-[#E5E7EB] flex items-center justify-center shrink-0" style={{ fontFamily: "var(--font-inter)" }}>
            <span className="text-[12px] font-medium text-muted">
              {(user?.firstName?.[0] || user?.primaryEmailAddress?.emailAddress?.[0] || "U").toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-ink truncate" style={{ fontFamily: "var(--font-inter)" }}>
              {user?.firstName || "User"}
            </p>
            <p className="text-xs text-faint truncate" style={{ fontFamily: "var(--font-inter)" }}>
              {user?.primaryEmailAddress?.emailAddress || ""}
            </p>
          </div>
        </div>
        <button
          onClick={() => signOut({ redirectUrl: "/" })}
          className="flex w-full items-center gap-3 rounded-[6px] px-3 py-2 mt-2 text-xs font-normal text-muted hover:text-ink hover:bg-[#F9FAFB] transition-all duration-120"
          style={{ fontFamily: "var(--font-inter)" }}
        >
          <LogOut className="size-[14px]" strokeWidth={1.5} />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
