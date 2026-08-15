"use client"

import { Moon, Sun } from "lucide-react"

export function ThemeToggle({ className = "" }: { className?: string }) {
  return (
    <button
      onClick={() => {
        const el = document.documentElement
        const dark = el.classList.toggle("dark")
        document.cookie = `hirestack-theme=${
          dark ? "dark" : "light"
        }; path=/; max-age=31536000; samesite=lax`
      }}
      aria-label="Toggle theme"
      title="Toggle theme"
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-muted transition-colors hover:text-ink hover:border-border-hover ${className}`}
    >
      <Sun className="size-4 dark:hidden" strokeWidth={1.5} />
      <Moon className="hidden size-4 dark:block" strokeWidth={1.5} />
    </button>
  )
}
