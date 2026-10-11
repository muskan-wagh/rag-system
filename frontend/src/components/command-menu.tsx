"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { Search, CornerDownLeft, type LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  Users,
  Search as SearchIcon,
  GitCompareArrows,
  Layers,
  CalendarDays,
  Bookmark,
  History,
  Settings,
  Briefcase,
  ClipboardList,
  FilePlus2,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Command {
  href: string
  label: string
  group: "Overview" | "Hiring" | "Library" | "Account" | "Create"
  icon: LucideIcon
  keywords?: string
}

const COMMANDS: Command[] = [
  { href: "/dashboard", label: "Dashboard", group: "Overview", icon: LayoutDashboard, keywords: "home overview metrics" },
  { href: "/interview", label: "Interviews", group: "Overview", icon: CalendarDays, keywords: "schedule round meeting" },

  { href: "/jobs", label: "All jobs", group: "Hiring", icon: Briefcase, keywords: "roles openings" },
  { href: "/candidates", label: "All candidates", group: "Hiring", icon: Users, keywords: "people applicants" },
  { href: "/candidates/search", label: "AI candidate search", group: "Hiring", icon: SearchIcon, keywords: "semantic rag find" },
  { href: "/compare", label: "Compare candidates", group: "Hiring", icon: GitCompareArrows, keywords: "side by side" },
  { href: "/assessments", label: "Assessments", group: "Hiring", icon: ClipboardList, keywords: "tests questions" },

  { href: "/pools", label: "Talent pools", group: "Library", icon: Layers, keywords: "groups lists" },
  { href: "/search", label: "Saved searches", group: "Library", icon: Bookmark, keywords: "bookmarks" },
  { href: "/history", label: "Activity history", group: "Library", icon: History, keywords: "audit log timeline" },

  { href: "/settings", label: "Settings", group: "Account", icon: Settings, keywords: "gmail integrations preferences" },

  { href: "/jobs", label: "Create a job", group: "Create", icon: FilePlus2, keywords: "new role post" },
  { href: "/assessments/new", label: "New assessment", group: "Create", icon: FilePlus2, keywords: "build test" },
]

export function CommandMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return COMMANDS
    return COMMANDS.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.group.toLowerCase().includes(q) ||
        c.keywords?.toLowerCase().includes(q),
    )
  }, [query])

  const [prevOpen, setPrevOpen] = useState(open)
  if (prevOpen !== open) {
    setPrevOpen(open)
    if (open) {
      setQuery("")
      setActiveIndex(0)
    }
  }

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  // Keep the highlighted row inside the scroll viewport while arrowing through.
  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
    node?.scrollIntoView({ block: "nearest" })
  }, [activeIndex])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      const count = Math.max(results.length, 1)
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        setActiveIndex((i) => (i + 1) % count)
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setActiveIndex((i) => (i - 1 + count) % count)
      } else if (e.key === "Enter") {
        e.preventDefault()
        const item = results[activeIndex]
        if (item) {
          router.push(item.href)
          onClose()
        }
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, results, activeIndex, router, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]"
          role="dialog"
          aria-modal="true"
          aria-label="Quick navigation"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="absolute inset-0 bg-black/25 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface shadow-xl"
          >
            <div className="flex items-center gap-2.5 border-b border-border px-4">
              <Search className="size-4 shrink-0 text-faint" strokeWidth={1.5} aria-hidden />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setActiveIndex(0)
                }}
                placeholder="Search pages and actions…"
                className="h-12 w-full bg-transparent text-[13px] text-ink placeholder:text-faint outline-none"
                aria-label="Search pages and actions"
                role="combobox"
                aria-expanded
                aria-controls="command-menu-list"
                aria-activedescendant={results[activeIndex] ? `command-${activeIndex}` : undefined}
              />
            </div>

            <div ref={listRef} id="command-menu-list" role="listbox" className="max-h-[340px] overflow-y-auto p-1.5">
              {results.length === 0 ? (
                <p className="px-3 py-8 text-center text-[12px] text-faint">
                  No results for “{query}”
                </p>
              ) : (
                <ul>
                  {results.map((item, i) => {
                    const showGroup =
                      i === 0 || results[i - 1].group !== item.group
                    return (
                      <li key={`${item.group}-${item.href}-${i}`}>
                        {showGroup && (
                          <p className="px-3 pb-1 pt-3 text-[10px] font-medium uppercase tracking-[0.08em] text-faint first:pt-1">
                            {item.group}
                          </p>
                        )}
                        <button
                          type="button"
                          id={`command-${i}`}
                          data-index={i}
                          role="option"
                          aria-selected={i === activeIndex}
                          onMouseEnter={() => setActiveIndex(i)}
                          onClick={() => {
                            router.push(item.href)
                            onClose()
                          }}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] transition-colors duration-100",
                            i === activeIndex ? "bg-surface-secondary text-ink" : "text-muted",
                          )}
                        >
                          <item.icon
                            className={cn(
                              "size-3.5 shrink-0",
                              i === activeIndex ? "text-ink" : "text-faint",
                            )}
                            strokeWidth={1.75}
                            aria-hidden
                          />
                          <span className="truncate">{item.label}</span>
                          {i === activeIndex && (
                            <CornerDownLeft className="ml-auto size-3 shrink-0 text-faint" strokeWidth={1.5} aria-hidden />
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-[10px] text-faint">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-surface-secondary px-1 py-0.5 font-data">↑↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-surface-secondary px-1 py-0.5 font-data">↵</kbd>
                open
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-surface-secondary px-1 py-0.5 font-data">esc</kbd>
                close
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
