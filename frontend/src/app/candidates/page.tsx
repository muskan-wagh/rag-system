"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Search, Sparkles, Loader2, ListFilter, LayoutGrid, ArrowRight, Lightbulb } from "lucide-react"
import { searchCandidates, type RankingResult } from "@/lib/api"
import { CandidateCard } from "@/components/candidate-card"
import { AiInsightsPanel } from "@/components/ai-insights-panel"
import { ResumeDrawer } from "@/components/resume-drawer"
import type { Candidate } from "@/lib/api"

type Tab = "results" | "analytics"

const examplePrompts = [
  "Senior React Developer with TypeScript",
  "Data Scientist NLP Python",
  "Full-stack Python AWS",
  "Product Manager SaaS",
]

export default function CandidatesPage() {
  const searchParams = useSearchParams()
  const [jdText, setJdText] = useState("")
  const [results, setResults] = useState<RankingResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState<Tab>("results")
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)

  useEffect(() => {
    const jd = searchParams.get("jd")
    if (jd) {
      setJdText(jd)
      performSearch(jd)
    }
  }, [searchParams])

  async function performSearch(text: string) {
    setLoading(true)
    setError("")
    try {
      const res = await searchCandidates(text, 10)
      if (res.success && res.data) {
        setResults(res.data.results)
        setActiveTab("results")
      } else {
        setError(res.error || "Search failed")
      }
    } catch {
      setError("Failed to connect to server")
    } finally {
      setLoading(false)
    }
  }

  async function handleSearch() {
    if (!jdText.trim()) return
    await performSearch(jdText)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSearch()
    }
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "results", label: "Results", count: results.length },
    { key: "analytics", label: "Analytics" },
  ]

  return (
    <div className="flex-1">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-purple-600 to-blue-600">
              <Search className="h-3 w-3 text-white" />
            </div>
            <h1 className="text-lg font-semibold text-white">Candidate Search</h1>
          </div>
          <p className="text-xs text-white/40">
            Paste a job description and let AI find the best matching candidates
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-4 ring-1 ring-white/[0.06] mb-6"
        >
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Sparkles className="absolute left-3 top-3 h-4 w-4 text-purple-400" />
              <textarea
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Paste a job description or describe your ideal candidate..."
                rows={2}
                className="w-full bg-transparent text-sm text-white placeholder-white/30 outline-none resize-none pl-9 pt-2.5"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-1.5">
                {examplePrompts.map((p) => (
                  <button
                    key={p}
                    onClick={() => { setJdText(p); performSearch(p) }}
                    className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-0.5 text-[10px] text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-all"
                  >
                    {p}
                  </button>
                ))}
              </div>
              <Button
                onClick={handleSearch}
                disabled={loading || !jdText.trim()}
                className="bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-500 hover:to-blue-500 h-8 px-4 text-xs"
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Search className="h-3.5 w-3.5 mr-1.5" />
                )}
                {loading ? "Searching..." : "Search"}
              </Button>
            </div>
            {error && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <span className="inline-block h-1 w-1 rounded-full bg-red-400" />
                {error}
              </p>
            )}
          </div>
        </motion.div>

        {results.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    activeTab === tab.key
                      ? "bg-white/[0.08] text-white"
                      : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
                  }`}
                >
                  {tab.key === "analytics" && <Lightbulb className="h-3 w-3" />}
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px]">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setViewMode("list")}
                className={`flex h-7 w-7 items-center justify-center rounded-md transition-all ${
                  viewMode === "list" ? "bg-white/[0.08] text-white" : "text-white/30 hover:text-white/50"
                }`}
              >
                <ListFilter className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`flex h-7 w-7 items-center justify-center rounded-md transition-all ${
                  viewMode === "grid" ? "bg-white/[0.08] text-white" : "text-white/30 hover:text-white/50"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}

        {activeTab === "results" && (
          <div className="flex gap-6">
            <div className="flex-1 min-w-0">
              {loading && (
                <div className="grid gap-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="glass rounded-2xl p-5 ring-1 ring-white/[0.06]">
                      <div className="flex gap-4">
                        <Skeleton className="h-12 w-12 rounded-xl bg-white/[0.06]" />
                        <div className="flex-1 space-y-3">
                          <Skeleton className="h-4 w-48 bg-white/[0.06]" />
                          <Skeleton className="h-3 w-full bg-white/[0.06]" />
                          <div className="flex gap-2">
                            <Skeleton className="h-5 w-16 rounded-full bg-white/[0.06]" />
                            <Skeleton className="h-5 w-20 rounded-full bg-white/[0.06]" />
                            <Skeleton className="h-5 w-14 rounded-full bg-white/[0.06]" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!loading && results.length > 0 && (
                <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 gap-3" : "space-y-3"}>
                  {results.map((result, i) => (
                    <div key={result.candidate.id} onClick={() => setSelectedCandidate(result.candidate)}>
                      <CandidateCard result={result} index={i} />
                    </div>
                  ))}
                </div>
              )}

              {!loading && !error && results.length === 0 && jdText && (
                <div className="glass rounded-2xl p-10 text-center ring-1 ring-white/[0.06]">
                  <p className="text-sm text-white/40">No candidates found. Try adjusting the job description.</p>
                </div>
              )}

              {!loading && results.length === 0 && !jdText && !error && (
                <div className="glass rounded-2xl p-14 text-center ring-1 ring-white/[0.06]">
                  <div className="flex justify-center mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600/20 to-blue-600/20 ring-1 ring-white/[0.06]">
                      <Search className="h-5 w-5 text-purple-400" />
                    </div>
                  </div>
                  <h3 className="text-sm font-medium text-white mb-2">Search Candidates</h3>
                  <p className="text-xs text-white/40 max-w-xs mx-auto">
                    Paste a job description above and click search to find ranked candidates with AI-powered matching.
                  </p>
                </div>
              )}
            </div>

            {results.length > 0 && (
              <div className="hidden lg:block w-72 shrink-0">
                <AiInsightsPanel results={results} jdText={jdText} />
              </div>
            )}
          </div>
        )}

        {activeTab === "analytics" && results.length > 0 && (
          <div className="glass rounded-2xl p-6 ring-1 ring-white/[0.06]">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-4 w-4 text-purple-400" />
              <h3 className="text-sm font-medium text-white">Analytics Overview</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: "Total Candidates", value: results.length },
                { label: "Avg Match Score", value: `${Math.round(results.reduce((s, r) => s + r.scores.overall, 0) / results.length * 100)}%` },
                { label: "Avg Experience", value: `${(results.reduce((s, r) => s + r.candidate.experience, 0) / results.length).toFixed(1)} yrs` },
                { label: "Top Match", value: `${Math.round(results[0].scores.overall * 100)}%` },
              ].map((stat) => (
                <div key={stat.label} className="glass rounded-xl p-4 ring-1 ring-white/[0.06]">
                  <div className="text-2xl font-bold text-gradient">{stat.value}</div>
                  <div className="text-[10px] text-white/40 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <ResumeDrawer
        candidate={selectedCandidate}
        onClose={() => setSelectedCandidate(null)}
      />
    </div>
  )
}

function BarChart3({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  )
}
