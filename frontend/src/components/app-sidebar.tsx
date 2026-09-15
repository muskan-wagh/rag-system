"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useUser, useAuth } from "@clerk/nextjs"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Users,
  Search,
  GitCompareArrows,
  Layers,
  CalendarDays,
  Bookmark,
  History,
  Settings,
  LogOut,
} from "lucide-react"
import { BrandLogo } from "@/components/brand"

const navSections = [
  {
    label: "Main",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, iconClass: "text-indigo-500 dark:text-indigo-400" },
      { href: "/candidates", label: "Candidates", icon: Users, iconClass: "text-info" },
      { href: "/candidates/search", label: "Search", icon: Search, iconClass: "text-success" },
      { href: "/compare", label: "Compare", icon: GitCompareArrows, iconClass: "text-warning" },
      { href: "/pools", label: "Pools", icon: Layers, iconClass: "text-info" },
      { href: "/interview", label: "Interviews", icon: CalendarDays, iconClass: "text-success" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/search", label: "Saved Searches", icon: Bookmark, iconClass: "text-warning" },
      { href: "/history", label: "History", icon: History, iconClass: "text-info" },
    ],
  },
  {
    label: "System",
    items: [{ href: "/settings", label: "Settings", icon: Settings, iconClass: "text-muted" }],
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
    <nav className="flex-1 overflow-y-auto px-3 pb-3" aria-label="Main navigation">
      {navSections.map((section) => (
        <div key={section.label} className="pt-4 first:pt-3">
          <p className="px-2 pb-1.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-faint">
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
                      "group flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors duration-120",
                      active
                        ? "bg-surface-secondary font-medium text-ink ring-1 ring-inset ring-border"
                        : "font-normal text-muted hover:bg-hover-tone hover:text-ink",
                    )}
                  >
                    <item.icon
                      className={cn(
                        "size-4 shrink-0 transition-all duration-120",
                        item.iconClass,
                        active ? "opacity-100" : "opacity-75 group-hover:opacity-100",
                      )}
                      strokeWidth={active ? 2 : 1.75}
                      aria-hidden
                    />
                    <span className="truncate leading-none">{item.label}</span>
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
    <div className="shrink-0 border-t border-border/70 px-3 py-3">
      <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-soft text-[10.5px] font-medium text-muted ring-1 ring-inset ring-border">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-medium leading-tight text-ink">
            {user?.firstName || "Recruiter"}
          </p>
          <p className="truncate text-[11px] leading-tight text-faint">
            {user?.primaryEmailAddress?.emailAddress || ""}
          </p>
        </div>
        <button
          onClick={() => signOut({ redirectUrl: "/" })}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-faint transition-colors duration-120 hover:bg-hover-tone hover:text-danger"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="size-3.5" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  )
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex h-[57px] shrink-0 items-center border-b border-border/60 px-4">
        <BrandLogo />
      </div>
      <NavItems onNavigate={onNavigate} />
      <SidebarFooter />
    </div>
  )
}

export function AppSidebar() {
  return (
    <aside className="fixed bottom-2 left-2 top-2 z-30 hidden w-[220px] flex-col overflow-hidden rounded-xl border border-border/80 bg-surface lg:flex">
      <SidebarContent />
    </aside>
  )
}
