"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Search, Sparkles, Command, ArrowRight, Clock, TrendingUp, Users, FileText, MessageSquare, Code } from "lucide-react"
import { ROUTES } from "@/lib/constants"
import { LoadingDots } from "@/components/ui/loading-dots"

const suggestions = [
  { icon: Code, text: "Find Senior React Developers with AWS experience" },
  { icon: FileText, text: "Rank candidates for this Job Description" },
  { icon: TrendingUp, text: "Show candidates with 5+ years experience" },
  { icon: MessageSquare, text: "Explain why Candidate #1 ranked highest" },
  { icon: Users, text: "Find candidates missing only one required skill" },
  { icon: Sparkles, text: "Generate hiring insights for this role" },
]

const recentSearches = [
  "Senior Frontend Engineer with TypeScript",
  "Data Scientist NLP Python",
  "Full-stack Developer Node.js React",
]

export function HeroSearch() {
  const [query, setQuery] = useState("")
  const [focused, setFocused] = useState(false)
  const [showRecent, setShowRecent] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  function handleSearch(value?: string) {
    const text = value || query
    if (!text.trim()) return
    setLoading(true)
    router.push(`${ROUTES.candidates}?jd=${encodeURIComponent(text)}`)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSearch()
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div
        className={`
          relative transition-all duration-300
          ${focused ? "scale-[1.01]" : "scale-100"}
        `}
      >
        <div
          className={`
            relative rounded-2xl bg-white shadow-sm border transition-all duration-300
            ${focused
              ? "border-primary/30 shadow-lg shadow-primary/5 ring-4 ring-primary/5"
              : "border-border hover:border-muted-foreground/20"
            }
          `}
        >
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => { setFocused(true); setShowRecent(true) }}
              onBlur={() => { setFocused(false); setTimeout(() => setShowRecent(false), 200) }}
              placeholder="Describe your ideal candidate or paste a job description..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-foreground/60 outline-none"
            />
            <div className="flex items-center gap-2">
              {loading ? (
                <LoadingDots size="md" />
              ) : (
                <>
                  <kbd className="hidden sm:inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground font-mono">
                    <Command className="h-2.5 w-2.5" />K
                  </kbd>
                  <button
                    onClick={() => handleSearch()}
                    disabled={!query.trim()}
                    className="flex items-center gap-1.5 rounded-lg bg-primary text-white px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                  >
                    <Search className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Search</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {showRecent && focused && (
          <div className="absolute top-full left-0 right-0 mt-2 rounded-xl bg-white border border-border shadow-lg overflow-hidden z-20 animate-scale-in">
            {recentSearches.length > 0 && (
              <div className="p-3">
                <div className="flex items-center gap-1.5 px-2 py-1.5">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Recent</span>
                </div>
                {recentSearches.map((search) => (
                  <button
                    key={search}
                    onClick={() => { setQuery(search); handleSearch(search) }}
                    className="w-full flex items-center gap-3 rounded-lg px-2 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all text-left"
                  >
                    <Clock className="h-3 w-3 shrink-0" />
                    {search}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {suggestions.slice(0, 3).map((suggestion) => (
          <button
            key={suggestion.text}
            onClick={() => { setQuery(suggestion.text); handleSearch(suggestion.text) }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/20 hover:bg-primary/[0.02] transition-all shadow-sm"
          >
            <suggestion.icon className="h-3 w-3" />
            {suggestion.text}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
        {[
          { label: "Smart Ranking", desc: "AI-powered scoring" },
          { label: "Explainable", desc: "Transparent results" },
          { label: "Fast Matching", desc: "Semantic search" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-primary/40" />
            <span className="text-muted-foreground/70">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
