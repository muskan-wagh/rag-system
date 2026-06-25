"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Sparkles } from "lucide-react"
import { ROUTES } from "@/lib/constants"

const examples = [
  "Senior React Developer with 5+ years and TypeScript experience",
  "Data Scientist skilled in NLP, Python, and TensorFlow",
  "Full-stack engineer with Python, AWS, and microservices",
  "Product Manager with SaaS and B2B background",
]

export function HeroSearch() {
  const [query, setQuery] = useState("")
  const router = useRouter()

  function handleSearch() {
    if (!query.trim()) return
    router.push(`${ROUTES.candidates}?jd=${encodeURIComponent(query)}`)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSearch()
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <div className="relative group">
        <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-purple-600/30 to-blue-600/30 opacity-0 group-focus-within:opacity-100 blur-xl transition-opacity duration-500" />
        <div className="relative flex items-center gap-2 glass-heavy rounded-2xl px-4 py-3 ring-1 ring-white/[0.08] group-focus-within:ring-purple-500/40 transition-all duration-300">
          <Sparkles className="h-5 w-5 text-purple-400 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste a job description or describe your ideal candidate..."
            className="flex-1 bg-transparent text-white placeholder-white/40 text-sm outline-none"
          />
          <button
            onClick={handleSearch}
            disabled={!query.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:from-purple-500 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
          >
            <Search className="h-3.5 w-3.5" />
            Search
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        {examples.map((ex) => (
          <button
            key={ex}
            onClick={() => setQuery(ex)}
            className="rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1 text-xs text-white/50 hover:text-white/80 hover:bg-white/[0.06] hover:border-white/[0.1] transition-all"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  )
}
