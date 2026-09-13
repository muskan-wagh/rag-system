"use client"

import { Suspense, useState, useEffect, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  Sparkles,
  Loader2,
  SlidersHorizontal,
  ArrowUpDown,
  BookmarkPlus,
  ArrowRight,
  X,
  TriangleAlert,
  CornerDownLeft,
  Wand2,
} from "lucide-react"
import { toast } from "sonner"
import { useApi } from "@/hooks/use-api"
import { CandidateCard } from "@/components/candidate-card"
import { ResumeDrawer } from "@/components/resume-drawer"
import { GmailOutreachModal } from "@/components/gmail-outreach-modal"
import { SearchSidebar } from "@/components/search-sidebar"
import { useSearchStore } from "@/lib/search-store"
import type { Candidate, RankingResult } from "@/lib/api"
import { ROUTES } from "@/lib/constants"
import { cn } from "@/lib/utils"

type SortKey = "overall" | "skill" | "experience"

const suggestionChips = [
  "Senior React Developer",
  "Full-stack TypeScript",
  "AI/ML Engineer",
  "Product Engineer",
]

const sortLabels: Record<SortKey, string> = {
  overall: "Overall Score",
  skill: "Skill Match",
  experience: "Experience",
}

function CandidatesContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [selectedResult, setSelectedResult] = useState<RankingResult | null>(null)
  const [emailCandidate, setEmailCandidate] = useState<Candidate | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>("overall")
  const [minScore, setMinScore] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [saveName, setSaveName] = useState("")
  const [saving, setSaving] = useState(false)

  const jdText = useSearchStore((s) => s.jdText)
  const setJdText = useSearchStore((s) => s.setJdText)
  const results = useSearchStore((s) => s.results)
  const parsedJD = useSearchStore((s) => s.parsedJD)
  const loading = useSearchStore((s) => s.loading)
  const error = useSearchStore((s) => s.error)
  const filters = useSearchStore((s) => s.filters)

  const api = useApi()
  const jdSkills = parsedJD?.skills ?? []

  const performSearch = useCallback(async (text: string) => {
    const { filters, setLoading, setError, setResults } = useSearchStore.getState()
    setLoading(true)
    setError("")
    try {
      const raw = filters as Record<string, unknown>
      const safeFilters: import('@/lib/api').SearchFilters = {}
      if (Array.isArray(raw.skills)) safeFilters.skills = raw.skills as string[]
      else if (typeof raw.skills === 'string' && (raw.skills as string).trim()) safeFilters.skills = (raw.skills as string).split(',').map(s => s.trim()).filter(Boolean)
      if (raw.minExperience !== undefined) safeFilters.minExperience = Number(raw.minExperience)
      if (raw.maxExperience !== undefined) safeFilters.maxExperience = Number(raw.maxExperience)
      if (raw.educationLevel) safeFilters.educationLevel = String(raw.educationLevel)
      const res = await api.searchCandidates(text, 20, safeFilters)
      if (res.success && res.data) {
        setResults(res.data.results, res.data.query)
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
    if (jdFromUrl && jdFromUrl !== useSearchStore.getState().jdText) {
      setJdText(jdFromUrl)
      performSearch(jdFromUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  async function handleSaveSearch() {
    const text = useSearchStore.getState().jdText
    if (!text.trim() || !saveName.trim()) return
    setSaving(true)
    try {
      const res = await api.createSavedSearch(saveName.trim(), text.trim(), filters as unknown as Record<string, unknown>)
      if (res.success) {
        toast.success("Search saved")
        setSaveName("")
        setShowSaveForm(false)
      } else {
        toast.error(res.error || "Failed to save search")
      }
    } catch {
      toast.error("Failed to save search")
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSearch()
    }
  }

  const sortedResults = [...results]
    .filter(r => (r.scores?.overall ?? 0) * 100 >= minScore)
    .sort((a, b) => (b.scores?.[sortKey] ?? 0) - (a.scores?.[sortKey] ?? 0))

  const missingJdSkills = jdSkills.filter(s => !results.some(r => r.candidate.skills.map(x => x.toLowerCase()).includes(s.toLowerCase()))).slice(0, 10)

  const hasResults = sortedResults.length > 0 && !loading
  const activeFilterCount =
    (filters.minExperience !== undefined ? 1 : 0) +
    (filters.maxExperience !== undefined ? 1 : 0) +
    (filters.educationLevel ? 1 : 0) +
    (filters.skills && filters.skills.length > 0 ? 1 : 0)

  return (
    <div className="min-h-screen flex-1">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-canvas shadow-sm">
              <Sparkles className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h1 className="text-[17px] font-semibold tracking-tight text-ink">
                AI Candidate Search
              </h1>
              <p className="truncate text-[12.5px] text-muted">
                Describe the candidate you&apos;re looking for and let HireStack surface the strongest matches.
              </p>
            </div>
          </div>
        </motion.div>

        {/* AI prompt console */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="relative mb-4"
        >
          {/* ambient glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-4 -top-6 bottom-0 bg-[radial-gradient(60%_90%_at_20%_0%,rgba(62,99,221,0.14),transparent_70%),radial-gradient(50%_80%_at_85%_10%,rgba(48,164,108,0.10),transparent_70%)]"
          />
          <div className="relative rounded-2xl bg-gradient-to-br from-info/40 via-border to-success/30 p-px shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
            <div className="rounded-[15px] bg-surface p-3 sm:p-4">
              {/* console header */}
              <div className="mb-2 flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-info to-success shadow-sm">
                  <Sparkles className="h-3.5 w-3.5 text-white" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-semibold leading-tight text-ink">
                    Ask HireStack AI
                  </p>
                  <p className="text-[11px] leading-tight text-faint">
                    Roles, skills, experience — describe it in plain words
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-success/25 bg-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-success">
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-success" />
                  </span>
                  Live
                </span>
              </div>

              {/* input well */}
              <div className="rounded-xl border border-border bg-canvas/60 transition-colors focus-within:border-border-hover">
                <textarea
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g. Senior React developer with TypeScript, 3+ years experience, strong frontend architecture skills…"
                  rows={2}
                  className="w-full resize-y bg-transparent px-3 pb-1 pt-2.5 text-[13px] leading-relaxed text-ink outline-none placeholder:text-faint"
                />
                <div className="flex items-center justify-between px-3 pb-2 pt-0.5">
                  <p className="text-[10.5px] text-faint">
                    {jdText.trim() ? `${jdText.trim().length} characters` : "Tip: mention must-have skills first"}
                  </p>
                  <kbd className="hidden items-center gap-1 rounded-md border border-border bg-surface-secondary/70 px-1.5 py-0.5 font-data text-[10px] text-muted sm:inline-flex">
                    Enter <CornerDownLeft className="h-3 w-3" strokeWidth={1.75} />
                  </kbd>
                </div>
              </div>

              {/* footer: chips + action */}
              <div className="mt-2.5 flex flex-col gap-2.5">
                <div className="flex flex-1 gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <span className="flex shrink-0 items-center gap-1 self-center text-[10.5px] font-medium uppercase tracking-[0.06em] text-faint">
                    <Wand2 className="h-3 w-3" strokeWidth={1.75} />
                    Try
                  </span>
                  {suggestionChips.map((p) => (
                    <button
                      key={p}
                      onClick={() => { setJdText(p); performSearch(p) }}
                      className="shrink-0 whitespace-nowrap rounded-full border border-border bg-surface-secondary/50 px-2.5 py-1 text-[11.5px] text-muted transition-all hover:border-info/40 hover:text-ink"
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-end">
                  <Button
                    onClick={handleSearch}
                    disabled={loading || !jdText.trim()}
                    className="h-9 w-full gap-2 px-5 text-[13px] font-semibold shadow-[0_4px_16px_rgba(0,0,0,0.3)] sm:w-auto"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                    ) : (
                      <Search className="h-4 w-4" strokeWidth={2} />
                    )}
                    {loading ? "Searching..." : "Search Candidates"}
                    {!loading && <ArrowRight className="h-4 w-4" strokeWidth={2} />}
                  </Button>
                </div>
              </div>
            </div>
          </div>
          {error && (
            <p className="mt-2.5 flex items-center gap-1.5 text-[12px] text-danger">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-danger" />
              {error}
            </p>
          )}
        </motion.div>

        {/* Results toolbar */}
        {(results.length > 0 || loading) && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-3 rounded-xl border border-border bg-surface px-3 py-2.5"
          >
            <div className="flex items-center gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex shrink-0 items-center gap-2 pr-1">
                <span className="text-[13px] font-semibold text-ink">Results</span>
                <span className="rounded-full bg-surface-secondary px-2 py-0.5 font-data text-[11px] font-medium text-muted">
                  {loading ? "…" : `${sortedResults.length} match${sortedResults.length === 1 ? "" : "es"}`}
                </span>
              </div>
              <span className="h-5 w-px shrink-0 bg-border" />
              <button
                onClick={() => setShowFilters((v) => !v)}
                className={cn(
                  "flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium transition-all",
                  showFilters || activeFilterCount > 0
                    ? "border-border-hover bg-surface-secondary text-ink"
                    : "border-border text-muted hover:text-ink",
                )}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
                Filters
                {activeFilterCount > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-semibold text-canvas">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <div className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[12px] text-muted">
                <ArrowUpDown className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span className="hidden text-muted min-[400px]:inline">Sort</span>
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                  className="cursor-pointer border-0 bg-transparent text-[12px] font-medium text-ink outline-none"
                  aria-label="Sort results"
                >
                  {(["overall", "skill", "experience"] as SortKey[]).map(k => (
                    <option key={k} value={k}>{sortLabels[k]}</option>
                  ))}
                </select>
              </div>
              <div className="flex h-8 shrink-0 items-center gap-2 rounded-lg border border-border px-2.5 text-[12px] text-muted">
                <span className="whitespace-nowrap">Match ≥</span>
                <input
                  type="range"
                  min={0}
                  max={90}
                  step={5}
                  value={minScore}
                  onChange={(e) => setMinScore(Number(e.target.value))}
                  className="h-1 w-16 cursor-pointer sm:w-20"
                  aria-label="Minimum match score"
                />
                <span className="w-8 text-right font-data text-[11px] font-medium text-ink">{minScore}%</span>
                {minScore > 0 && (
                  <button
                    onClick={() => setMinScore(0)}
                    className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-surface-secondary"
                    aria-label="Clear match threshold"
                  >
                    <X className="h-3 w-3" strokeWidth={1.75} />
                  </button>
                )}
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-1.5 pl-1">
                <button
                  onClick={() => setShowSaveForm((v) => !v)}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[12px] font-medium text-muted transition-all hover:text-ink"
                >
                  <BookmarkPlus className="h-3.5 w-3.5" strokeWidth={1.75} />
                  <span className="hidden sm:inline">Saved Search</span>
                  <span className="sm:hidden">Save</span>
                </button>
              </div>
            </div>

            {showSaveForm && (
              <div className="mt-2.5 flex flex-col gap-2 border-t border-border pt-2.5 sm:flex-row">
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Name this search (e.g. Senior React Q3)…"
                  className="h-9 flex-1 rounded-lg border border-border bg-surface px-3 text-[13px] text-ink outline-none transition-colors placeholder:text-faint focus:border-border-hover"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveSearch} disabled={!saveName.trim() || saving}>
                    {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />}
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setShowSaveForm(false); setSaveName("") }}>
                    Cancel
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => router.push(ROUTES.savedSearches)}>
                    View saved
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Filters panel */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-3 rounded-xl border border-border bg-surface p-4"
          >
            <SearchSidebar className="block w-full" />
          </motion.div>
        )}

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-surface p-5">
                <div className="flex gap-3">
                  <Skeleton className="size-11 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-28" />
                    <div className="flex gap-1.5">
                      <Skeleton className="h-5 w-16 rounded-md" />
                      <Skeleton className="h-5 w-20 rounded-md" />
                      <Skeleton className="h-5 w-14 rounded-md" />
                    </div>
                  </div>
                  <Skeleton className="size-[52px] shrink-0 rounded-full" />
                </div>
                <div className="mt-3 space-y-2">
                  <Skeleton className="h-2 w-full rounded-full" />
                  <Skeleton className="h-2 w-3/4 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Results grid */}
        {!loading && hasResults && (
          <>
            {missingJdSkills.length > 0 && (
              <div className="mb-3 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 px-3 py-2.5">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" strokeWidth={1.75} />
                <div className="min-w-0">
                  <span className="text-[11.5px] font-medium text-warning">Missing across all candidates: </span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {missingJdSkills.map(s => (
                      <Badge key={s} variant="warning" className="text-[10px]">{s}</Badge>
                    ))}
                  </span>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {sortedResults.map((result, i) => (
                <div
                  key={result.candidate.id}
                  onClick={() => setSelectedResult(result)}
                  className="cursor-pointer"
                >
                  <CandidateCard
                    result={result}
                    index={i}
                    variant="recommendation"
                    jdSkills={jdSkills}
                    onView={() => setSelectedResult(result)}
                    onAddToPool={handleAddToPool}
                    onEmail={(id) => {
                      const c = results.find((r) => r.candidate.id === id)?.candidate ?? null
                      setEmailCandidate(c)
                    }}
                  />
                </div>
              ))}
            </div>
            <p className="mt-4 text-center text-[12px] text-faint">
              Showing {sortedResults.length} of {results.length} candidates
            </p>
          </>
        )}

        {!loading && !error && sortedResults.length === 0 && results.length > 0 && (
          <div className="rounded-xl border border-border bg-surface p-6 text-center">
            <p className="text-[13px] text-muted">All candidates filtered out. Try lowering the minimum match threshold.</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => { setMinScore(0) }}>
              Clear threshold
            </Button>
          </div>
        )}

        {!loading && !error && results.length === 0 && jdText && (
          <EmptyState
            icon={Search}
            title="No candidates found"
            description="Try adjusting your description or clearing filters to find more candidates."
          />
        )}

        {!loading && results.length === 0 && !jdText && !error && (
          <EmptyState
            icon={Sparkles}
            title="AI Candidate Search"
            description="Describe your ideal candidate above and get instant AI-powered matches ranked by fit."
          />
        )}
      </div>

      <ResumeDrawer
        candidate={selectedResult?.candidate ?? null}
        result={selectedResult}
        onClose={() => setSelectedResult(null)}
        onAddToPool={handleAddToPool}
        onEmail={(id) => {
          const c = results.find((r) => r.candidate.id === id)?.candidate ?? null
          setEmailCandidate(c)
        }}
      />

      {emailCandidate && (
        <GmailOutreachModal
          open
          onClose={() => setEmailCandidate(null)}
          candidateId={emailCandidate.id}
          candidateName={emailCandidate.name}
          candidateEmail={emailCandidate.email || ""}
        />
      )}
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
