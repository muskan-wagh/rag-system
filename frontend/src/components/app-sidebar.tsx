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
  Bookmark,
  History,
  Settings,
  LogOut,
  ClipboardList,
} from "lucide-react"
import { BrandLogo } from "@/components/brand"
import { Tooltip } from "@/components/ui/tooltip"

interface NavItem {
  href: string
  label: string
  icon: typeof LayoutDashboard
  /** Tokenised accent so every icon reads correctly in light and dark. */
  tone: string
}

/**
 * Sidebar navigation.
 *
 * Deliberately SHORT. Recruitment stages do not get their own entries: the
 * recruiter must be able to manage a candidate from shortlisting through to the
 * hiring decision without hopping between disconnected sections, so the whole
 * pipeline lives in the single Assessments workspace.
 *
 * The `/jobs` and `/interview` entries were removed because job management and
 * the technical/interview stages are now tabs inside that workspace. Neither
 * route was deleted from the backend — they are simply no longer separate
 * navigation destinations.
 */
const navSections: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, tone: "text-accent" },
    ],
  },
  {
    label: "Hiring",
    items: [
      { href: "/assessments", label: "Assessments", icon: ClipboardList, tone: "text-accent" },
      { href: "/candidates", label: "Candidates", icon: Users, tone: "text-ink" },
      { href: "/candidates/search", label: "AI search", icon: Search, tone: "text-accent" },
      { href: "/compare", label: "Compare", icon: GitCompareArrows, tone: "text-ink" },
    ],
  },
  {
    label: "Library",
    items: [
      { href: "/pools", label: "Talent pools", icon: Layers, tone: "text-ink" },
      { href: "/search", label: "Saved searches", icon: Bookmark, tone: "text-ink" },
      { href: "/history", label: "Activity", icon: History, tone: "text-ink" },
    ],
  },
  {
    label: "Account",
    items: [{ href: "/settings", label: "Settings", icon: Settings, tone: "text-muted" }],
  },
]

export function isNavActive(href: string, pathname: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard"
  if (href === "/candidates")
    return pathname === "/candidates" || /^\/candidates\/[^/]+$/.test(pathname)
  if (href === "/candidates/search") return pathname.startsWith("/candidates/search")
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <nav className="flex-1 overflow-y-auto px-3 pb-3" aria-label="Main">
      {navSections.map((section) => (
        <div key={section.label} className="pt-5 first:pt-4">
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
                      "group relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors duration-120",
                      active
                        ? "bg-surface-secondary font-medium text-ink"
                        : "font-normal text-muted hover:bg-hover-tone hover:text-ink",
                    )}
                  >
                    {/* Active marker doubles as the non-colour affordance. */}
                    <span
                      aria-hidden
                      className={cn(
                        "absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r-full bg-ink transition-opacity duration-150",
                        active ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <item.icon
                      className={cn(
                        "size-4 shrink-0 transition-opacity duration-120",
                        item.tone,
                        active ? "opacity-100" : "opacity-70 group-hover:opacity-100",
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
  const name = user?.firstName || user?.fullName || "Recruiter"
  const email = user?.primaryEmailAddress?.emailAddress || ""
  const initials = (user?.firstName?.[0] || email[0] || "U").toUpperCase()

  return (
    <div className="shrink-0 border-t border-border/70 p-3">
      <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-soft font-data text-[10.5px] font-medium text-muted ring-1 ring-inset ring-border">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-medium leading-tight text-ink">{name}</p>
          {email && (
            <p className="truncate text-[11px] leading-tight text-faint">{email}</p>
          )}
        </div>
        <Tooltip label="Sign out" side="top">
          <button
            type="button"
            onClick={() => signOut({ redirectUrl: "/" })}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-faint transition-colors duration-120 hover:bg-hover-tone hover:text-danger"
            aria-label="Sign out"
          >
            <LogOut className="size-3.5" strokeWidth={1.75} aria-hidden />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex h-[56px] shrink-0 items-center border-b border-border/60 px-4">
        <Link href="/dashboard" onClick={onNavigate} aria-label="HireStack dashboard">
          <BrandLogo size={26} />
        </Link>
      </div>
      <NavItems onNavigate={onNavigate} />
      <SidebarFooter />
    </div>
  )
}

export function AppSidebar() {
  return (
    <aside className="fixed bottom-2 left-2 top-2 z-30 hidden w-[228px] flex-col overflow-hidden rounded-xl border border-border bg-surface lg:flex">
      <SidebarContent />
    </aside>
  )
}
