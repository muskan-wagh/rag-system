"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { Search, CornerDownLeft } from "lucide-react"
import { cn } from "@/lib/utils"

const pages = [
  { href: "/dashboard", label: "Dashboard", group: "Main" },
  { href: "/candidates", label: "Candidates", group: "Main" },
  { href: "/candidates/search", label: "Candidate Search", group: "Main" },
  { href: "/compare", label: "Compare Candidates", group: "Main" },
  { href: "/pools", label: "Talent Pools", group: "Main" },
  { href: "/interview", label: "Interviews", group: "Main" },
  { href: "/search", label: "Saved Searches", group: "Workspace" },
  { href: "/history", label: "History", group: "Workspace" },
  { href: "/settings", label: "Settings", group: "System" },
]

interface CommandMenuProps {
  open: boolean
  onClose: () => void
}

export function CommandMenu({ open, onClose }: CommandMenuProps) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return pages
    return pages.filter(
      (p) => p.label.toLowerCase().includes(q) || p.group.toLowerCase().includes(q),
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
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        setActiveIndex((i) => (i + 1) % Math.max(results.length, 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setActiveIndex((i) => (i - 1 + Math.max(results.length, 1)) % Math.max(results.length, 1))
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
            className="absolute inset-0 bg-black/30"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="relative w-full max-w-lg overflow-hidden rounded-[10px] border border-border bg-surface shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
          >
            <div className="flex items-center gap-2.5 border-b border-border px-4">
              <Search className="size-4 shrink-0 text-faint" strokeWidth={1.5} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setActiveIndex(0)
                }}
                placeholder="Search or jump to…"
                className="h-12 w-full bg-transparent text-[13px] text-ink placeholder:text-faint outline-none"
                aria-label="Search pages"
              />
            </div>
            <div className="max-h-[320px] overflow-y-auto p-1.5">
              {results.length === 0 ? (
                <p className="px-3 py-6 text-center text-[12px] text-faint">
                  No results for “{query}”
                </p>
              ) : (
                <ul>
                  {results.map((item, i) => (
                    <li key={item.href}>
                      <button
                        onMouseEnter={() => setActiveIndex(i)}
                        onClick={() => {
                          router.push(item.href)
                          onClose()
                        }}
                        className={cn(
                          "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-[13px] transition-colors duration-100",
                          i === activeIndex
                            ? "bg-surface-secondary text-ink"
                            : "text-muted",
                        )}
                      >
                        <span className="truncate">{item.label}</span>
                        <span className="flex items-center gap-1 text-[10px] text-faint">
                          <span className="uppercase tracking-wide">{item.group}</span>
                          {i === activeIndex && (
                            <CornerDownLeft className="size-3" strokeWidth={1.5} />
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-[10px] text-faint">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-surface-secondary px-1 py-0.5">↑</kbd>
                <kbd className="rounded border border-border bg-surface-secondary px-1 py-0.5">↓</kbd>
                to navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-surface-secondary px-1 py-0.5">↵</kbd>
                to open
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-surface-secondary px-1 py-0.5">esc</kbd>
                to close
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}