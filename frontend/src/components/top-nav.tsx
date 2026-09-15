"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { Menu, Search } from "lucide-react"
import { CommandMenu } from "@/components/command-menu"
import { NotificationsMenu } from "@/components/notifications-menu"
import { ThemeToggle } from "@/components/theme-toggle"

function getPageContext(pathname: string): string {
  const seg = pathname.split("/").filter(Boolean)
  const primary = seg[0]
  const map: Record<string, string> = {
    dashboard: "Dashboard",
    candidates: "Candidates",
    compare: "Compare",
    pools: "Talent Pools",
    interview: "Interviews",
    search: "Saved Searches",
    history: "History",
    settings: "Settings",
    upload: "Application",
    "sign-in": "Sign in",
    "sign-up": "Sign up",
  }
  if (seg.length === 1) return map[primary] ?? "Workspace"
  const base = map[primary] ?? ""
  const sub = seg[seg.length - 1]
  if (primary === "candidates" || primary === "pools") {
    if (sub === "search") return `${base} / Search`
    return primary === "candidates" ? `${base} / Candidate` : `${base} / Details`
  }
  if (primary === "upload") return `${base} / Apply`
  return base || "Workspace"
}

export function TopNav({ onOpenMobile }: { onOpenMobile?: () => void }) {
  const { user } = useUser()
  const router = useRouter()
  const pathname = usePathname()
  const [commandOpen, setCommandOpen] = useState(false)
  const [modKey] = useState(() =>
    typeof navigator !== "undefined" && /Mac/i.test(navigator.platform) ? "⌘" : "Ctrl",
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setCommandOpen((open) => !open)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const context = getPageContext(pathname)

  return (
    <>
      <div className="sticky top-0 z-20 bg-canvas pb-3 pt-4 sm:pt-5">
        <header className="flex h-11 w-full items-center gap-2 rounded-md border border-border bg-surface px-[18px] shadow-[0_1px_2px_rgba(0,0,0,0.05)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.4)] sm:h-12 sm:gap-2.5 sm:px-6">
          <button
            onClick={onOpenMobile}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-secondary hover:text-ink lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="size-4" strokeWidth={1.5} />
          </button>

          <nav className="flex min-w-0 items-center gap-2 text-[13px]" aria-label="Breadcrumb">
            <span className="hidden shrink-0 text-muted sm:inline">Workspace</span>
            <span className="hidden shrink-0 text-faint sm:inline" aria-hidden>
              /
            </span>
            <p className="truncate font-medium tracking-tight text-ink">{context}</p>
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <button
              onClick={() => setCommandOpen(true)}
              className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-canvas px-2 text-[12px] text-faint transition-colors duration-120 hover:border-border-hover hover:text-muted"
              aria-label="Open quick navigation"
            >
              <Search className="size-3.5" strokeWidth={1.5} />
              <span className="hidden md:inline">Jump to…</span>
              <kbd className="hidden rounded border border-border bg-surface px-1 py-px font-data text-[10px] text-faint md:inline">
                {modKey}K
              </kbd>
            </button>

            <span className="mx-0.5 h-4 w-px shrink-0 bg-border" aria-hidden />

            <NotificationsMenu />

            <ThemeToggle className="size-8 shrink-0" />

            <button
              onClick={() => router.push("/settings")}
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-soft text-[11px] font-medium text-muted ring-1 ring-border transition-all duration-120 hover:text-ink hover:ring-border-hover"
              aria-label="Open profile"
            >
              {(
                user?.firstName?.[0] ||
                user?.primaryEmailAddress?.emailAddress?.[0] ||
                "U"
              ).toUpperCase()}
            </button>
          </div>
        </header>
      </div>

      <CommandMenu open={commandOpen} onClose={() => setCommandOpen(false)} />
    </>
  )
}