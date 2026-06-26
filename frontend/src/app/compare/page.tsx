"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ComparisonView } from "@/components/comparison-view"
import { EmptyState } from "@/components/ui/empty-state"
import { GitCompare, Sparkles, Loader2, Plus, Trash2, Users } from "lucide-react"
import { compareCandidates, batchCandidates, type Candidate } from "@/lib/api"

export default function ComparePage() {
  const [jdText, setJdText] = useState("")
  const [candidateIds, setCandidateIds] = useState<string[]>(["", ""])
  const [comparison, setComparison] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [foundCandidates, setFoundCandidates] = useState<Map<string, Candidate>>(new Map())

  function updateId(index: number, value: string) {
    const next = [...candidateIds]
    next[index] = value
    setCandidateIds(next)
  }

  function addRow() {
    setCandidateIds([...candidateIds, ""])
  }

  function removeRow(index: number) {
    if (candidateIds.length <= 2) return
    setCandidateIds(candidateIds.filter((_, i) => i !== index))
  }

  async function handleCompare() {
    if (!jdText.trim() || candidateIds.some((id) => !id.trim())) {
      setError("Please fill in all fields")
      return
    }
    setLoading(true)
    setError("")

    try {
      const batchRes = await batchCandidates(candidateIds)
      const nameMap = new Map<string, Candidate>()
      if (batchRes.success && batchRes.data) {
        for (const candidate of batchRes.data) {
          nameMap.set(candidate.id, candidate)
        }
      }
      setFoundCandidates(nameMap)

      const compareRes = await compareCandidates(jdText, candidateIds)
      if (compareRes.success && compareRes.data) {
        setComparison(compareRes.data.comparison)
      } else {
        setError(compareRes.error || "Comparison failed")
      }
    } catch {
      setError("Failed to connect to server")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1">
      <div className="mx-auto max-w-5xl px-4 md:px-6 py-6 md:py-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary shadow-sm">
              <GitCompare className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-foreground">Compare Candidates</h1>
              <p className="text-xs text-muted-foreground">
                Side-by-side AI-powered candidate comparison
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-2xl p-5 border border-border space-y-4 card-hover"
        >
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Job Description</label>
            <div className="relative">
              <Sparkles className="absolute left-3 top-2.5 h-4 w-4 text-primary" />
              <textarea
                placeholder="Paste job description for comparison context..."
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                rows={2}
                className="w-full bg-muted/30 text-sm text-foreground placeholder-muted-foreground/60 outline-none rounded-xl border border-border pl-9 pr-3 py-2.5 focus:border-primary/30 transition-colors resize-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            {candidateIds.map((id, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-medium text-primary">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <input
                    placeholder={`Candidate ID (e.g., cand-00${index + 1})`}
                    value={id}
                    onChange={(e) => updateId(index, e.target.value)}
                    className="w-full bg-muted/30 text-sm text-foreground placeholder-muted-foreground/50 outline-none rounded-xl border border-border px-3 py-2 focus:border-primary/30 transition-colors"
                  />
                  {foundCandidates.has(id) && (
                    <p className="text-[11px] text-primary mt-1 ml-1">
                      {foundCandidates.get(id)?.name}
                    </p>
                  )}
                </div>
                {candidateIds.length > 2 && (
                  <button
                    onClick={() => removeRow(index)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted/60 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="ghost"
              onClick={addRow}
              size="sm"
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Candidate
            </Button>
            <Button
              onClick={handleCompare}
              disabled={loading}
              size="sm"
              className="bg-primary text-white hover:bg-primary/90 ml-auto shadow-sm"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <GitCompare className="h-3.5 w-3.5 mr-1.5" />
              )}
              {loading ? "Comparing..." : "Compare"}
            </Button>
          </div>

          {error && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <span className="inline-block h-1 w-1 rounded-full bg-destructive" />
              {error}
            </p>
          )}
        </motion.div>

        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 bg-white rounded-2xl p-5 border border-border space-y-3"
          >
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-5/6" />
          </motion.div>
        )}

        {comparison && !loading && (
          <div className="mt-6">
            <ComparisonView
              jdText={jdText}
              comparison={comparison}
              candidates={foundCandidates}
              candidateIds={candidateIds}
            />
          </div>
        )}

        {!loading && !comparison && !error && !jdText && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="mt-6"
          >
            <EmptyState
              icon={Users}
              title="Compare Candidates"
              description="Add candidate IDs and a job description to get an AI-powered side-by-side comparison with score breakdowns."
            />
          </motion.div>
        )}
      </div>
    </div>
  )
}
