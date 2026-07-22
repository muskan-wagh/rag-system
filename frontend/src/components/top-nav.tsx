"use client"

import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { Bell, Search } from "lucide-react"

export function TopNav() {
  const { user } = useUser()
  const router = useRouter()

  return (
    <div className="flex items-center justify-between h-14 px-6 border-b border-border bg-[#FAFAFA]">
      <div>
        <p className="text-[13px] text-muted" style={{ fontFamily: "var(--font-inter)" }}>
          Welcome back
        </p>
        <p className="text-[13px] font-medium text-ink" style={{ fontFamily: "var(--font-inter)" }}>
          {user?.firstName || "there"}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/candidates/search")}
          className="flex items-center gap-2 h-9 px-3.5 rounded-[8px] bg-surface border border-border text-[13px] text-faint hover:text-ink hover:border-border-hover transition-all duration-120 w-[240px]"
          style={{ fontFamily: "var(--font-inter)" }}
        >
          <Search className="size-4" strokeWidth={1.5} style={{ color: "var(--faint)" }} />
          <span>Search candidates...</span>
        </button>

        <button className="relative size-9 rounded-[8px] border border-border bg-surface flex items-center justify-center text-muted hover:text-ink hover:border-border-hover transition-all duration-120">
          <Bell className="size-[18px]" strokeWidth={1.5} />
          <span className="absolute top-[6px] right-[6px] size-[5px] rounded-full bg-danger" />
        </button>

        <div className="size-8 rounded-full bg-[#E5E7EB] flex items-center justify-center text-sm font-medium text-muted shrink-0" style={{ fontFamily: "var(--font-inter)" }}>
          {(user?.firstName?.[0] || user?.primaryEmailAddress?.emailAddress?.[0] || "U").toUpperCase()}
        </div>
      </div>
    </div>
  )
}
