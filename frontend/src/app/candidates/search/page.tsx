"use client"

import { Suspense, useState, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ProgressBar } from "@/components/ui/progress-bar"
import { EmptyState } from "@/components/ui/empty-state"
import { Search, Sparkles, Loader2, SlidersHorizontal, ListFilter, LayoutGrid, X } from "lucide-react"
import { useApi } from "@/hooks/use-api"
import { CandidateCard } from "@/components/candidate-card"
import { AiInsightsPanel } from "@/components/ai-insights-panel"
import { ResumeDrawer } from "@/components/resume-drawer"
import { SearchSidebar } from "@/components/search-sidebar"
import { useSearchStore, isCacheValid } from "@/lib/search-store"
import type { Candidate } from "@/lib/api"

type Tab = "results" | "analytics"

const examplePrompts = [
  "Senior React Developer with TypeScript",
  "Data Scientist NLP Python",
  "Full-stack Python AWS",
  "Product Manager SaaS",
]

const SCROLL_KEY = "recruitiq-scroll-candidates"

function CandidatesContent() {
  const searchParams = useSearchParams()

  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)

  const jdText = useSearchStore((s) => s.jdText)
  const setJdText = useSearchStore((s) => s.setJdText)
  const results = useSearchStore((s) => s.results)
  const loading = useSearchStore((s) => s.loading)
  const error = useSearchStore((s) => s.error)
  const activeTab = useSearchStore((s) => s.activeTab)
  const setActiveTab = useSearchStore((s) => s.setActiveTab)
  const viewMode = useSearchStore((s) => s.viewMode)
  const setViewMode = useSearchStore((s) => s.setViewMode)
  const showMobileFilters = useSearchStore((s) => s.showMobileFilters)
  const setShowMobileFilters = useSearchStore((s) => s.setShowMobileFilters)
  const lastSearchTimestamp = useSearchStore((s) => s.lastSearchTimestamp)

  const api = useApi()

  const performSearch = useCallback(async (text: string) => {
    const { filters, setLoading, setError, setResults, setActiveTab } = useSearchStore.getState()
    setLoading(true)
    setError("")
    try {
      const raw = filters as Record<string, unknown>;
      const safeFilters: import('@/lib/api').SearchFilters = {};
      if (Array.isArray(raw.skills)) safeFilters.skills = raw.skills as string[];
      else if (typeof raw.skills === 'string' && (raw.skills as string).trim()) safeFilters.skills = (raw.skills as string).split(',').map(s => s.trim()).filter(Boolean);
      if (raw.minExperience !== undefined) safeFilters.minExperience = Number(raw.minExperience);
      if (raw.maxExperience !== undefined) safeFilters.maxExperience = Number(raw.maxExperience);
      if (raw.educationLevel) safeFilters.educationLevel = String(raw.educationLevel);
      const res = await api.searchCandidates(text, 20, safeFilters)
      if (res.success && res.data) {
        setResults(res.data.results, res.data.query)
        setActiveTab("results")
      } else {
        setError(res.error || "Search failed")
      }
    } catch {
      setError("Failed to connect to server")
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    const jdFromUrl = searchParams.get("jd")
    const hasCachedResults = results.length > 0 && isCacheValid(lastSearchTimestamp)

    if (jdFromUrl && jdFromUrl !== jdText) {
      setJdText(jdFromUrl)
      performSearch(jdFromUrl)
    } else if (!hasCachedResults && jdText) {
      performSearch(jdText)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const savedY = localStorage.getItem(SCROLL_KEY)
    if (savedY && results.length > 0) {
      requestAnimationFrame(() => {
        window.scrollTo(0, parseInt(savedY, 10))
      })
    }
  }, [results.length])

  useEffect(() => {
    let ticking = false
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          localStorage.setItem(SCROLL_KEY, String(window.scrollY))
          ticking = false
        })
        ticking = true
      }
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => {
      localStorage.setItem(SCROLL_KEY, String(window.scrollY))
      window.removeEventListener("scroll", handleScroll)
    }
  }, [])

  async function handleSearch() {
    const text = useSearchStore.getState().jdText
    if (!text.trim()) return
    await performSearch(text)
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

  const analyticsStats = results.length > 0 ? [
    { label: "Total Candidates", value: results.length },
    { label: "Avg Match Score", value: `${Math.round(results.reduce((s, r) => s + r.scores.overall, 0) / results.length * 100)}%` },
    { label: "Avg Experience", value: `${(results.reduce((s, r) => s + r.candidate.experience, 0) / results.length).toFixed(1)} yrs` },
    { label: "Top Match", value: `${Math.round(results[0].scores.overall * 100)}%` },
  ] : []

  return (
    <div className="flex-1">
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-6 md:py-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary shadow-sm">
              <Search className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-foreground">Candidate Search</h1>
              <p className="text-xs text-muted-foreground">
                AI-powered candidate discovery and ranking
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-2xl p-4 border border-border mb-6 card-hover"
        >
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Sparkles className="absolute left-3 top-3 h-4 w-4 text-primary" />
              <textarea
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Paste a job description or describe your ideal candidate..."
                rows={2}
                className="w-full bg-transparent text-sm text-foreground placeholder-muted-foreground/60 outline-none resize-none pl-9 pt-2.5"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5 flex-1">
                {examplePrompts.map((p) => (
                  <button
                    key={p}
                    onClick={() => { setJdText(p); performSearch(p) }}
                    className="rounded-full border border-border bg-white px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/20 transition-all"
                  >
                    {p}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowMobileFilters(!showMobileFilters)}
                  className="lg:hidden flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filters
                </button>
                <Button
                  onClick={handleSearch}
                  disabled={loading || !jdText.trim()}
                  className="bg-primary text-white hover:bg-primary/90 h-8 px-4 text-xs shadow-sm"
                >
                  {loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Search className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {loading ? "Searching..." : "Search"}
                </Button>
              </div>
            </div>
            {error && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <span className="inline-block h-1 w-1 rounded-full bg-destructive" />
                {error}
              </p>
            )}
          </div>
        </motion.div>

        <div className="flex gap-6">
          <SearchSidebar
            className="hidden lg:block w-56 shrink-0"
          />

          <div className="flex-1 min-w-0">
            {results.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                        activeTab === tab.key
                          ? "bg-primary/5 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }`}
                    >
                      {tab.label}
                      {tab.count !== undefined && (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    AI analyzed {results.length} candidates
                  </span>
                  <div className="flex items-center gap-1 border-l border-border pl-2">
                    <button
                      onClick={() => setViewMode("list")}
                      className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
                        viewMode === "list" ? "bg-primary/5 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }`}
                    >
                      <ListFilter className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setViewMode("grid")}
                      className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
                        viewMode === "grid" ? "bg-primary/5 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }`}
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "results" && (
              <>
                {loading && (
                  <div className="grid gap-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="bg-white rounded-2xl p-5 border border-border">
                        <div className="flex gap-4">
                          <Skeleton className="h-12 w-12 rounded-xl" />
                          <div className="flex-1 space-y-3">
                            <Skeleton className="h-4 w-48" />
                            <Skeleton className="h-3 w-full" />
                            <div className="flex gap-2">
                              <Skeleton className="h-5 w-16 rounded-full" />
                              <Skeleton className="h-5 w-20 rounded-full" />
                              <Skeleton className="h-5 w-14 rounded-full" />
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
                      <div key={result.candidate.id} onClick={() => setSelectedCandidate(result.candidate)} className="cursor-pointer">
                        <CandidateCard result={result} index={i} />
                      </div>
                    ))}
                  </div>
                )}

                {!loading && results.length > 0 && (
                  <div className="mt-6 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Showing 1-{results.length} of {results.length} candidates
                    </span>
                    <div className="flex items-center gap-1">
                      <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all disabled:opacity-40" disabled>
                        Previous
                      </button>
                      <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/5 text-primary text-xs font-medium">
                        1
                      </button>
                      <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all disabled:opacity-40" disabled>
                        Next
                      </button>
                    </div>
                  </div>
                )}

                {!loading && !error && results.length === 0 && jdText && (
                  <EmptyState
                    icon={Search}
                    title="No candidates found"
                    description="Try adjusting your job description or filters to find more candidates."
                  />
                )}

                {!loading && results.length === 0 && !jdText && !error && (
                  <EmptyState
                    icon={Search}
                    title="Search Candidates"
                    description="Paste a job description above and click search to find ranked candidates with AI-powered matching."
                  />
                )}
              </>
            )}

            {activeTab === "analytics" && results.length > 0 && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl p-5 border border-border">
                  <h3 className="text-sm font-medium text-foreground mb-4">Analytics Overview</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {analyticsStats.map((stat) => (
                      <div key={stat.label} className="bg-muted/50 rounded-xl p-4">
                        <div className="text-2xl font-bold text-primary">{stat.value}</div>
                        <div className="text-[11px] text-muted-foreground mt-1">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-border">
                  <h3 className="text-sm font-medium text-foreground mb-4">Score Breakdown</h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      {(["skill", "experience", "education"] as const).map((key) => {
                        const avg = results.reduce((s, r) => s + r.scores[key], 0) / results.length
                        return (
                          <ProgressBar
                            key={key}
                            value={avg * 100}
                            label={key.charAt(0).toUpperCase() + key.slice(1)}
                            color={key === "skill" ? "bg-primary" : key === "experience" ? "bg-accent" : "bg-chart-3"}
                          />
                        )
                      })}
                    </div>
                    <div className="glass rounded-xl p-4">
                      <p className="text-xs text-muted-foreground mb-2">AI Recommendation</p>
                      <p className="text-xs text-foreground/80 leading-relaxed">
                        Based on the current job description, the top candidates show strong alignment in required skills and experience level. Consider reviewing the top 3 candidates for initial interviews.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {results.length > 0 && (
            <div className="hidden xl:block w-72 shrink-0">
              <AiInsightsPanel results={results} jdText={jdText} />
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showMobileFilters && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/10 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setShowMobileFilters(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-72 z-50 bg-white border-r border-border p-6 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-medium text-foreground">Filters</h3>
                <button onClick={() => setShowMobileFilters(false)} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-muted transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <SearchSidebar className="!block" />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ResumeDrawer
        candidate={selectedCandidate}
        onClose={() => setSelectedCandidate(null)}
      />
    </div>
  )
}

export default function CandidatesPage() {
  return (
    <Suspense fallback={null}>
      <CandidatesContent />
    </Suspense>
  )
}
