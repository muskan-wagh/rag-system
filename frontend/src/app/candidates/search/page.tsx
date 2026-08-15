"use client"

import { Suspense, useState, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ProgressBar } from "@/components/ui/progress-bar"
import { EmptyState } from "@/components/ui/empty-state"
import { Badge } from "@/components/ui/badge"
import { Search, Sparkles, Loader2, SlidersHorizontal, ListFilter, LayoutGrid, X, ArrowUpDown, Brain, FlaskConical } from "lucide-react"
import { toast } from "sonner"
import { useApi } from "@/hooks/use-api"
import { CandidateCard } from "@/components/candidate-card"
import { AiInsightsPanel } from "@/components/ai-insights-panel"
import { ResumeDrawer } from "@/components/resume-drawer"
import { SearchSidebar } from "@/components/search-sidebar"
import { useSearchStore, isCacheValid } from "@/lib/search-store"
import type { Candidate } from "@/lib/api"
import { cn } from "@/lib/utils"

type Tab = "results" | "analytics"
type SortKey = "overall" | "skill" | "experience"

const examplePrompts = [
  "Senior React Developer with TypeScript",
  "Data Scientist NLP Python",
  "Full-stack Python AWS",
  "Product Manager SaaS",
]

const SCROLL_KEY = "hirestack-scroll-candidates"

const sortLabels: Record<SortKey, string> = {
  overall: "Overall Score",
  skill: "Skill Match",
  experience: "Experience",
}

function CandidatesContent() {
  const searchParams = useSearchParams()
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>("overall")
  const [minScore, setMinScore] = useState(0)

  const jdText = useSearchStore((s) => s.jdText)
  const setJdText = useSearchStore((s) => s.setJdText)
  const results = useSearchStore((s) => s.results)
  const parsedJD = useSearchStore((s) => s.parsedJD)
  const loading = useSearchStore((s) => s.loading)
  const error = useSearchStore((s) => s.error)
  const activeTab = useSearchStore((s) => s.activeTab)
  const setActiveTab = useSearchStore((s) => s.setActiveTab)
  const viewMode = useSearchStore((s) => s.viewMode)
  const setViewMode = useSearchStore((s) => s.setViewMode)
  const resultViewMode = useSearchStore((s) => s.resultViewMode)
  const setResultViewMode = useSearchStore((s) => s.setResultViewMode)
  const showMobileFilters = useSearchStore((s) => s.showMobileFilters)
  const setShowMobileFilters = useSearchStore((s) => s.setShowMobileFilters)
  const lastSearchTimestamp = useSearchStore((s) => s.lastSearchTimestamp)

  const api = useApi()
  const jdSkills = parsedJD?.skills ?? []

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
    if (savedY && resultViewMode === "workspace" && results.length > 0) {
      requestAnimationFrame(() => {
        window.scrollTo(0, parseInt(savedY, 10))
      })
    }
  }, [results.length, resultViewMode])

  useEffect(() => {
    if (resultViewMode !== "workspace") return
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
  }, [resultViewMode])

  async function handleSearch() {
    const text = useSearchStore.getState().jdText
    if (!text.trim()) return
    await performSearch(text)
  }

  async function handleAddToPool(candidateId: string, name: string) {
    try {
      const pools = await api.listTalentPools()
      if (!pools.success || !pools.data || pools.data.length === 0) {
        toast.error("No talent pools available. Create one first.")
        return
      }
      const pool = pools.data[0]
      const res = await api.addCandidateToPool(pool.id, candidateId)
      if (res.success) {
        toast.success(`${name} added to ${pool.name}`)
      } else {
        toast.error(res.error || "Failed to add to pool")
      }
    } catch {
      toast.error("Failed to add candidate to pool")
    }
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

  // Determine filter & sort for Results view
  const sortedResults = [...results]
    .filter(r => r.scores.overall * 100 >= minScore)
    .sort((a, b) => b.scores[sortKey] - a.scores[sortKey])

  const missingJdSkills = jdSkills.filter(s => !results.some(r => r.candidate.skills.includes(s))).slice(0, 10)

  const hasResults = sortedResults.length > 0 && !loading

  return (
    <div className="flex-1 min-h-screen">
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-6 md:py-8">
        {/* Header — single, shared */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink text-canvas shadow-sm">
              {resultViewMode === "results" ? (
                <Brain className="h-3.5 w-3.5" />
              ) : (
                <Search className="h-3.5 w-3.5" />
              )}
            </div>
            <div>
              <h1 className="text-base font-semibold text-ink">
                {resultViewMode === "results" ? "AI Candidate Search" : "Candidate Search"}
              </h1>
              <p className="text-xs text-muted">
                {resultViewMode === "results"
                  ? "AI-powered candidate matching — instant recommendations"
                  : "Full ATS workspace with filters, analytics, and insights"
                }
              </p>
            </div>
          </div>
        </motion.div>

        {/* Search bar — shared */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-surface rounded-lg p-4 border border-border mb-4 "
        >
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Sparkles className="absolute left-3 top-3 h-4 w-4 text-ink" />
              <textarea
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Paste a job description or describe your ideal candidate..."
                rows={2}
                className="w-full bg-transparent text-sm text-ink placeholder:faint/60 outline-none resize-none pl-9 pt-2.5"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5 flex-1">
                {examplePrompts.map((p) => (
                  <button
                    key={p}
                    onClick={() => { setJdText(p); performSearch(p) }}
                    className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] text-muted hover:text-ink hover:border-border-hover transition-all"
                  >
                    {p}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowMobileFilters(!showMobileFilters)}
                  className="lg:hidden flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-ink hover:bg-surface-secondary transition-all"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filters
                </button>
                <Button
                  onClick={handleSearch}
                  disabled={loading || !jdText.trim()}
                  className="bg-ink text-canvas hover:bg-ink/90 h-8 px-4 text-xs shadow-sm"
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
              <p className="text-xs text-danger flex items-center gap-1">
                <span className="inline-block h-1 w-1 rounded-full bg-destructive" />
                {error}
              </p>
            )}
          </div>
        </motion.div>

        {/* View mode switch + toolbar */}
        {results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-3 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              {/* View switcher — subtle segmented control */}
              <div className="flex rounded-lg border border-border p-0.5 bg-surface-secondary">
                <button
                  onClick={() => setResultViewMode("results")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all",
                    resultViewMode === "results"
                      ? "bg-surface text-ink shadow-sm"
                      : "text-muted hover:text-ink"
                  )}
                >
                  <Brain className="h-3.5 w-3.5" />
                  Results
                </button>
                <button
                  onClick={() => setResultViewMode("workspace")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all",
                    resultViewMode === "workspace"
                      ? "bg-surface text-ink shadow-sm"
                      : "text-muted hover:text-ink"
                  )}
                >
                  <FlaskConical className="h-3.5 w-3.5" />
                  Workspace
                </button>
              </div>
            </div>

            {/* Right toolbar — different per view */}
            {resultViewMode === "results" && (
              <div className="flex items-center gap-2">
                {/* Sort */}
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <ArrowUpDown className="h-3 w-3" />
                  <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as SortKey)}
                    className="bg-transparent border-0 text-xs text-ink font-medium outline-none cursor-pointer"
                  >
                    {(["overall", "skill", "experience"] as SortKey[]).map(k => (
                      <option key={k} value={k}>{sortLabels[k]}</option>
                    ))}
                  </select>
                </div>
                {/* Min score slider */}
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted">
                  <span className="text-faint">Min:</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={minScore}
                    onChange={(e) => setMinScore(Number(e.target.value))}
                    className="w-20 h-1"
                  />
                  <span className="font-data text-ink text-[11px] w-6 text-right">{minScore}%</span>
                </div>
                <span className="text-xs text-muted border-l border-border pl-2 ml-1">
                  {sortedResults.length} match{sortedResults.length !== 1 ? "es" : ""}
                </span>
              </div>
            )}

            {resultViewMode === "workspace" && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">
                  AI analyzed {results.length} candidates
                </span>
                <div className="flex items-center gap-1 border-l border-border pl-2">
                  <button
                    onClick={() => setViewMode("list")}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-lg transition-all",
                      viewMode === "list" ? "bg-surface-secondary text-ink" : "text-muted hover:text-ink hover:bg-surface-secondary"
                    )}
                  >
                    <ListFilter className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode("grid")}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-lg transition-all",
                      viewMode === "grid" ? "bg-surface-secondary text-ink" : "text-muted hover:text-ink hover:bg-surface-secondary"
                    )}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Main content area — two distinct layouts */}
        <div className="flex gap-6">
          {/* Sidebar — only in Workspace view */}
          {resultViewMode === "workspace" && (
            <SearchSidebar className="hidden lg:block w-56 shrink-0" />
          )}

          <div className="flex-1 min-w-0">
            {loading && (
              <div className={resultViewMode === "results" ? "grid grid-cols-1 md:grid-cols-2 gap-3" : "space-y-3"}>
                {Array.from({ length: resultViewMode === "results" ? 4 : 3 }).map((_, i) => (
                  <div key={i} className="bg-surface rounded-lg p-5 border border-border">
                    <div className="flex gap-4">
                      <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
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

            {/* RESULTS VIEW — AI-first, quick recommendations */}
            {!loading && resultViewMode === "results" && (
              <>
                {/* Skill gaps alert */}
                {hasResults && missingJdSkills.length > 0 && (
                  <div className="mb-3 flex items-center gap-2 rounded-lg border border-warning bg-warning/10 px-3 py-2">
                    <span className="text-[11px] font-medium text-warning whitespace-nowrap">Missing across all candidates:</span>
                    <div className="flex flex-wrap gap-1">
                      {missingJdSkills.map(s => (
                        <Badge key={s} variant="warning" className="text-[10px]">{s}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {hasResults && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {sortedResults.map((result, i) => {
                      return (
                        <div
                          key={result.candidate.id}
                          onClick={() => setSelectedCandidate(result.candidate)}
                          className="cursor-pointer"
                        >
                          <CandidateCard
                            result={result}
                            index={i}
                            variant="recommendation"
                            jdSkills={jdSkills}
                            onAddToPool={handleAddToPool}
                          />
                        </div>
                      )
                    })}
                  </div>
                )}

                {!loading && !error && sortedResults.length === 0 && results.length > 0 && (
                  <div className="bg-surface rounded-lg p-6 border border-border text-center">
                    <p className="text-sm text-muted">All candidates filtered out. Try lowering the minimum score.</p>
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
                    icon={Brain}
                    title="AI Candidate Search"
                    description="Paste a job description above and get instant AI-powered recommendations ranked by fit score."
                  />
                )}
              </>
            )}

            {/* WORKSPACE VIEW — full ATS experience */}
            {!loading && resultViewMode === "workspace" && (
              <>
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
                          className={cn(
                            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                            activeTab === tab.key
                              ? "bg-surface-secondary text-ink"
                              : "text-muted hover:text-ink hover:bg-surface-secondary"
                          )}
                        >
                          {tab.label}
                          {tab.count !== undefined && (
                            <span className="rounded-full bg-surface-secondary px-1.5 py-0.5 text-[10px]">{tab.count}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {activeTab === "results" && (
                  <>
                    {!loading && results.length > 0 && (
                      <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 gap-3" : "space-y-3"}>
                        {results.map((result, i) => (
                          <div key={result.candidate.id} onClick={() => setSelectedCandidate(result.candidate)} className="cursor-pointer">
                            <CandidateCard result={result} index={i} variant="detailed" />
                          </div>
                        ))}
                      </div>
                    )}

                    {!loading && results.length > 0 && (
                      <div className="mt-6 flex items-center justify-between">
                        <span className="text-xs text-muted">
                          Showing 1-{results.length} of {results.length} candidates
                        </span>
                        <div className="flex items-center gap-1">
                          <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-xs text-muted hover:text-ink hover:bg-surface-secondary transition-all disabled:opacity-40" disabled>
                            Previous
                          </button>
                          <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-secondary text-ink text-xs font-medium">
                            1
                          </button>
                          <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-xs text-muted hover:text-ink hover:bg-surface-secondary transition-all disabled:opacity-40" disabled>
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
                    <div className="bg-surface rounded-lg p-5 border border-border">
                      <h3 className="text-sm font-medium text-ink mb-4">Analytics Overview</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {analyticsStats.map((stat) => (
                          <div key={stat.label} className="bg-surface-secondary rounded-xl p-4">
                            <div className="text-2xl font-bold text-ink">{stat.value}</div>
                            <div className="text-[11px] text-muted mt-1">{stat.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-surface rounded-lg p-5 border border-border">
                      <h3 className="text-sm font-medium text-ink mb-4">Score Breakdown</h3>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-3">
                          {(["skill", "experience", "education"] as const).map((key) => {
                            const avg = results.reduce((s, r) => s + r.scores[key], 0) / results.length
                            return (
                              <ProgressBar
                                key={key}
                                value={avg * 100}
                                label={key.charAt(0).toUpperCase() + key.slice(1)}
                                color={key === "skill" ? "bg-info" : key === "experience" ? "bg-warning" : "bg-success"}
                              />
                            )
                          })}
                        </div>
                        <div className="rounded-xl bg-surface-secondary p-4">
                          <p className="text-xs text-muted mb-2">AI Recommendation</p>
                          <p className="text-xs text-ink/80 leading-relaxed">
                            Based on the current job description, the top candidates show strong alignment in required skills and experience level. Consider reviewing the top 3 candidates for initial interviews.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* AiInsightsPanel — only in Workspace view */}
          {resultViewMode === "workspace" && results.length > 0 && (
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
              className="fixed left-0 top-0 bottom-0 w-72 z-50 bg-surface border-r border-border p-6 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-medium text-ink">Filters</h3>
                <button onClick={() => setShowMobileFilters(false)} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-surface-secondary transition-colors">
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
