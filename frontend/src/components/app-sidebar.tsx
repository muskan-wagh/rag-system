"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useUser, useAuth } from "@clerk/nextjs"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Users,
  Search,
  GitCompare,
  Layers,
  Calendar,
  Bookmark,
  History,
  Settings,
  LogOut,
} from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { BrandLogo } from "@/components/brand"

const navSections = [
  {
    label: "Main",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/candidates", label: "Candidates", icon: Users },
      { href: "/candidates/search", label: "Search", icon: Search },
      { href: "/compare", label: "Compare", icon: GitCompare },
      { href: "/pools", label: "Pools", icon: Layers },
      { href: "/interview", label: "Interviews", icon: Calendar },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/search", label: "Saved Searches", icon: Bookmark },
      { href: "/history", label: "History", icon: History },
    ],
  },
  {
    label: "System",
    items: [{ href: "/settings", label: "Settings", icon: Settings }],
  },
] as const

export function isNavActive(href: string, pathname: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard"
  if (href === "/candidates") return pathname === "/candidates" || /^\/candidates\/[^/]+$/.test(pathname)
  if (href === "/candidates/search") return pathname.startsWith("/candidates/search")
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Main navigation">
      {navSections.map((section) => (
        <div key={section.label}>
          <p className="px-2.5 pt-6 pb-1.5 text-[10px] font-medium uppercase tracking-[0.07em] text-faint">
            {section.label}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = isNavActive(item.href, pathname)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors duration-120",
                      active
                        ? "bg-surface-secondary font-medium text-ink"
                        : "font-normal text-muted hover:bg-hover-tone hover:text-ink",
                    )}
                  >
                    <item.icon
                      className="size-4 shrink-0"
                      strokeWidth={active ? 2 : 1.5}
                      aria-hidden
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function SidebarFooter() {
  const { user } = useUser()
  const { signOut } = useAuth()
  const initials = (
    user?.firstName?.[0] ||
    user?.primaryEmailAddress?.emailAddress?.[0] ||
    "U"
  ).toUpperCase()

  return (
    <div className="border-t border-border px-3 py-3">
      <div className="flex items-center gap-2.5">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-soft text-[11px] font-medium text-muted">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-medium text-ink">
            {user?.firstName || "Recruiter"}
          </p>
          <p className="truncate text-[10px] text-faint">
            {user?.primaryEmailAddress?.emailAddress || ""}
          </p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <button
          onClick={() => signOut({ redirectUrl: "/" })}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-normal text-muted transition-colors duration-120 hover:bg-hover-tone hover:text-ink"
        >
          <LogOut className="size-3.5" strokeWidth={1.5} />
          Sign out
        </button>
        <ThemeToggle className="h-7 w-7" />
      </div>
    </div>
  )
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center px-5 pb-2 pt-5">
        <BrandLogo />
      </div>
      <NavItems onNavigate={onNavigate} />
      <SidebarFooter />
    </div>
  )
}

export function AppSidebar() {
  return (
    <aside className="fixed bottom-0 left-0 top-0 z-30 hidden w-[232px] flex-col border-r border-border bg-surface lg:flex">
      <SidebarContent />
    </aside>
  )
}
