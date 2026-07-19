"use client"

import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { Bell, Search, Command } from "lucide-react"

export function TopNav() {
  const { user } = useUser()
  const router = useRouter()

  return (
    <div className="flex items-center justify-between h-[72px] px-12">
      <div>
        <h2 className="text-sm font-medium text-[#6B7280]">
          Welcome back
        </h2>
        <h1 className="text-lg font-medium text-[#111111] mt-0.5">
          {user?.firstName || "there"}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/candidates/search")}
          className="flex items-center gap-2 h-9 px-4 rounded-full bg-[#F6F6F4] text-sm text-[#6B7280] hover:text-[#111111] transition-colors min-w-[240px]"
        >
          <Search className="h-3.5 w-3.5" strokeWidth={1.5} />
          <span>Search candidates...</span>
          <div className="ml-auto flex items-center gap-0.5 text-[10px] text-[#A3A3A3]">
            <Command className="h-2.5 w-2.5" />
            <span>K</span>
          </div>
        </button>

        <button className="relative h-9 w-9 rounded-full bg-[#F6F6F4] flex items-center justify-center text-[#6B7280] hover:text-[#111111] transition-colors">
          <Bell className="h-3.5 w-3.5" strokeWidth={1.5} />
          <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-[#111111]" />
        </button>

        <div className="h-9 w-9 rounded-full bg-[#F6F6F4] flex items-center justify-center text-sm font-medium text-[#111111]">
          {(user?.firstName?.[0] || user?.primaryEmailAddress?.emailAddress?.[0] || "U").toUpperCase()}
        </div>
      </div>
    </div>
  )
}
