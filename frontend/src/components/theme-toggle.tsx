"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/lib/use-theme"
import { cn } from "@/lib/utils"

/**
 * Flips between the two explicit schemes. "System" stays reachable from
 * Settings, so this button can never settle into a state where clicking it
 * re-applies the value it is already on.
 *
 * Both icons are rendered and picked purely in CSS off the `dark` class on
 * <html>, which the pre-paint script has already set correctly — so the glyph
 * is right on first paint and the markup is identical on server and client
 * (no hydration mismatch). The label follows `resolved` through the store's
 * server snapshot so it hydrates consistently and self-corrects after mount.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolved, setChoice } = useTheme()

  const next = resolved === "dark" ? "light" : "dark"

  return (
    <button
      type="button"
      onClick={() => setChoice(next)}
      aria-label={`Theme: ${resolved}. Switch to ${next}.`}
      title={`Theme: ${resolved} — click for ${next}`}
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted transition-colors hover:border-border-hover hover:text-ink",
        className,
      )}
    >
      <span className="inline-flex dark:hidden" aria-hidden>
        <Sun className="size-4" strokeWidth={1.5} />
      </span>
      <span className="hidden dark:inline-flex" aria-hidden>
        <Moon className="size-4" strokeWidth={1.5} />
      </span>
    </button>
  )
}
