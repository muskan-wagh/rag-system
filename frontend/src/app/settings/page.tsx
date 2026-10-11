"use client"

import Link from "next/link"
import { useUser } from "@clerk/nextjs"
import { Monitor, Moon, Palette, Sun, ArrowUpRight, ShieldCheck } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { GmailSettingsCard } from "@/components/gmail-settings-card"
import { useTheme, type ThemeChoice } from "@/lib/use-theme"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const THEME_OPTIONS: Array<{
  value: ThemeChoice
  label: string
  icon: typeof Sun
  hint: string
}> = [
  { value: "light", label: "Light", icon: Sun, hint: "Always light" },
  { value: "dark", label: "Dark", icon: Moon, hint: "Always dark" },
  { value: "system", label: "System", icon: Monitor, hint: "Match your device" },
]

export default function SettingsPage() {
  const { user } = useUser()
  const { choice, setChoice } = useTheme()

  const name = user?.fullName || user?.firstName || "Recruiter"
  const email = user?.primaryEmailAddress?.emailAddress || ""

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Your account, integrations and appearance." />

      <div className="grid max-w-3xl gap-4">
        {/* Account */}
        <section className="rounded-xl border border-border bg-surface p-4 shadow-xs sm:p-5">
          <div className="flex items-start gap-3.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-canvas">
              <ShieldCheck className="size-4 text-muted" strokeWidth={1.75} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[13.5px] font-medium text-ink">Account</h2>
              <p className="mt-0.5 text-[12.5px] text-muted">
                Signed in as <span className="font-medium text-ink">{name}</span>
                {email && <> · {email}</>}
              </p>
              <p className="mt-2 text-[12px] leading-relaxed text-muted">
                Authentication is handled by Clerk. Candidates never get an account —
                they apply, test and interview through personal links.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                render={<Link href="/sign-in" target="_blank" />}
              >
                Manage account
                <ArrowUpRight strokeWidth={1.75} />
              </Button>
            </div>
          </div>
        </section>

        {/* Integrations */}
        <GmailSettingsCard />

        {/* Appearance */}
        <section className="rounded-xl border border-border bg-surface p-4 shadow-xs sm:p-5">
          <div className="flex items-start gap-3.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-canvas">
              <Palette className="size-4 text-muted" strokeWidth={1.75} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[13.5px] font-medium text-ink">Appearance</h2>
              <p className="mt-0.5 text-[12.5px] text-muted">
                HireStack stores your choice and applies it on every device you sign in
                from.
              </p>

              <div
                className="mt-3.5 grid gap-2 sm:grid-cols-3"
                role="radiogroup"
                aria-label="Colour scheme"
              >
                {THEME_OPTIONS.map((option) => {
                  const active = choice === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setChoice(option.value)}
                      className={cn(
                        "flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all duration-150",
                        active
                          ? "border-accent-border bg-accent-soft"
                          : "border-border bg-canvas hover:border-border-hover hover:bg-surface-secondary",
                      )}
                    >
                      <option.icon
                        className={cn("size-4", active ? "text-accent" : "text-muted")}
                        strokeWidth={1.75}
                        aria-hidden
                      />
                      <span>
                        <span
                          className={cn(
                            "block text-[12.5px] font-medium",
                            active ? "text-ink" : "text-ink",
                          )}
                        >
                          {option.label}
                        </span>
                        <span className="block text-[11px] text-muted">{option.hint}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
