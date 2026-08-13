"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { Menu, Search } from "lucide-react"
import { CommandMenu } from "@/components/command-menu"
import { NotificationsMenu } from "@/components/notifications-menu"

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
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-canvas/85 px-4 backdrop-blur-md sm:px-6">
        <button
          onClick={onOpenMobile}
          className="flex size-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-hover-tone hover:text-ink lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="size-4" strokeWidth={1.5} />
        </button>

        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-ink">{context}</p>
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setCommandOpen(true)}
            className="flex h-8 items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-[12px] text-faint transition-colors duration-120 hover:border-border-hover hover:text-muted"
            aria-label="Open quick navigation"
          >
            <Search className="size-3.5" strokeWidth={1.5} />
            <span className="hidden md:inline">Jump to…</span>
            <kbd className="hidden rounded border border-border bg-surface-secondary px-1.5 py-0.5 font-data text-[10px] text-faint md:inline">
              {modKey}K
            </kbd>
          </button>

          <NotificationsMenu />

          <button
            onClick={() => router.push("/settings")}
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-soft text-[11px] font-medium text-muted transition-colors duration-120 hover:bg-surface-secondary"
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

      <CommandMenu open={commandOpen} onClose={() => setCommandOpen(false)} />
    </>
  )
}