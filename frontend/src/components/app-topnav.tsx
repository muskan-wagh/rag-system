"use client"

import { useAuth, UserButton } from "@clerk/nextjs"
import { MagnifyingGlass, Bell, CaretDown } from "@phosphor-icons/react"

export function AppTopnav() {
  const { userId } = useAuth()

  if (!userId) return null

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-border bg-white/95 backdrop-blur-sm px-4">
      <div className="relative flex-1 max-w-md">
        <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" weight="bold" />
        <input
          type="search"
          placeholder="Search candidates, jobs, or skills..."
          className="h-7 w-full rounded-md border border-border bg-muted/50 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20 transition-colors"
        />
      </div>
      <div className="flex items-center gap-1.5">
        <button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <Bell className="h-3.5 w-3.5" weight="bold" />
        </button>
        <div className="flex items-center gap-2 pl-2 border-l border-border">
          <UserButton
            appearance={{
              elements: {
                avatarBox: "h-6 w-6",
              },
            }}
          />
          <CaretDown className="h-3 w-3 text-muted-foreground" weight="bold" />
        </div>
      </div>
    </header>
  )
}
