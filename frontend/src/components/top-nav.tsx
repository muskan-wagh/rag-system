"use client"

import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { Bell, Search } from "lucide-react"

export function TopNav() {
  const { user } = useUser()
  const router = useRouter()

  return (
    <div className="flex items-center justify-between h-16 px-8 border-b border-border bg-[#FAFAFA]">
      <div>
        <p className="text-sm text-muted" style={{ fontFamily: "var(--font-inter)" }}>
          Welcome back
        </p>
        <p className="text-sm font-medium text-ink" style={{ fontFamily: "var(--font-inter)" }}>
          {user?.firstName || "there"}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/candidates/search")}
          className="flex items-center gap-2.5 h-10 px-4 rounded-[8px] bg-surface border border-border text-sm text-faint hover:text-ink hover:border-border-hover transition-all duration-120 w-[280px]"
          style={{ fontFamily: "var(--font-inter)" }}
        >
          <Search className="size-4" strokeWidth={1.5} style={{ color: "var(--faint)" }} />
          <span>Search candidates...</span>
        </button>

        <button className="relative size-10 rounded-[8px] border border-border bg-surface flex items-center justify-center text-muted hover:text-ink hover:border-border-hover transition-all duration-120">
          <Bell className="size-5" strokeWidth={1.5} />
          <span className="absolute top-[6px] right-[6px] size-[6px] rounded-full bg-danger" />
        </button>

        <div className="size-8 rounded-full bg-[#E5E7EB] flex items-center justify-center text-sm font-medium text-muted shrink-0" style={{ fontFamily: "var(--font-inter)" }}>
          {(user?.firstName?.[0] || user?.primaryEmailAddress?.emailAddress?.[0] || "U").toUpperCase()}
        </div>
      </div>
    </div>
  )
}
