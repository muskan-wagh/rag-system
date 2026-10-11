"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { Menu, Search } from "lucide-react"
import { CommandMenu } from "@/components/command-menu"
import { NotificationsMenu } from "@/components/notifications-menu"
import { ThemeToggle } from "@/components/theme-toggle"

/** Breadcrumb per top-level section, plus overrides for sub-routes. */
const SECTION_LABEL: Record<string, string> = {
  dashboard: "Dashboard",
  jobs: "Jobs",
  candidates: "Candidates",
  compare: "Compare",
  interview: "Interviews",
  assessments: "Assessments",
  pools: "Talent pools",
  search: "Saved searches",
  history: "Activity",
  settings: "Settings",
  candidate: "Candidate report",
  gmail: "Gmail",
  upload: "Application",
  "sign-in": "Sign in",
  "sign-up": "Sign up",
}

function getBreadcrumb(pathname: string): string[] {
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length === 0) return ["Workspace"]

  const [primary, ...rest] = segments
  const base = SECTION_LABEL[primary] ?? "Workspace"

  if (rest.length === 0) return [base]

  if (primary === "candidates" && rest[0] === "search") return [base, "AI search"]
  if (primary === "candidates") return [base, "Profile"]
  if (primary === "jobs" && rest[0] === "screening") return [base, "Screening"]
  if (primary === "jobs") return [base, "Workspace"]
  if (primary === "pools") return [base, "Details"]
  if (primary === "assessments" && rest[0] === "new") return [base, "New assessment"]
  if (primary === "assessments" && rest[0] === "take") return [base, "Candidate view"]
  if (primary === "assessments") return [base, "Editor"]
  if (primary === "interview" || primary === "hr-interview") return [base, "Join"]
  if (primary === "upload") return [base, "Apply"]

  return [base]
}

export function TopNav({ onOpenMobile }: { onOpenMobile?: () => void }) {
  const { user } = useUser()
  const router = useRouter()
  const pathname = usePathname()
  const [commandOpen, setCommandOpen] = useState(false)
  // Read once during the first client render; server always renders "Ctrl".
  const [modKey] = useState(() =>
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)
      ? "\u2318"
      : "Ctrl",
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

  const crumbs = getBreadcrumb(pathname)
  const initials = (
    user?.firstName?.[0] ||
    user?.primaryEmailAddress?.emailAddress?.[0] ||
    "U"
  ).toUpperCase()

  return (
    <>
      <div className="sticky top-0 z-20 bg-canvas/85 pb-3 pt-4 backdrop-blur-md sm:pt-5">
        <header className="flex h-12 w-full items-center gap-2.5 rounded-xl border border-border bg-surface px-3 shadow-xs sm:px-5">
          <button
            type="button"
            onClick={onOpenMobile}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-secondary hover:text-ink lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="size-4" strokeWidth={1.5} aria-hidden />
          </button>

          <nav className="flex min-w-0 items-center gap-1.5 text-[13px]" aria-label="Breadcrumb">
            {crumbs.map((crumb, i) => (
              <span key={`${crumb}-${i}`} className="flex min-w-0 items-center gap-1.5">
                {i > 0 && (
                  <span className="text-faint" aria-hidden>
                    /
                  </span>
                )}
                <span
                  className={
                    i === crumbs.length - 1
                      ? "truncate font-medium tracking-tight text-ink"
                      : "hidden shrink-0 text-muted sm:inline"
                  }
                  aria-current={i === crumbs.length - 1 ? "page" : undefined}
                >
                  {crumb}
                </span>
              </span>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-canvas px-2 text-[12px] text-faint transition-colors duration-120 hover:border-border-hover hover:text-muted"
              aria-label="Open quick navigation"
            >
              <Search className="size-3.5" strokeWidth={1.5} aria-hidden />
              <span className="hidden md:inline">Jump to</span>
              <kbd className="hidden rounded border border-border bg-surface px-1 py-px font-data text-[10px] text-faint md:inline">
                {modKey}K
              </kbd>
            </button>

            <span className="mx-0.5 h-4 w-px shrink-0 bg-border" aria-hidden />

            <NotificationsMenu />
            <ThemeToggle className="size-8 shrink-0" />

            <button
              type="button"
              onClick={() => router.push("/settings")}
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-soft font-data text-[11px] font-medium text-muted ring-1 ring-border transition-all duration-120 hover:text-ink hover:ring-border-hover"
              aria-label="Open profile settings"
            >
              {initials}
            </button>
          </div>
        </header>
      </div>

      <CommandMenu open={commandOpen} onClose={() => setCommandOpen(false)} />
    </>
  )
}

export { getBreadcrumb }
