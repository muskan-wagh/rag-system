"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ComparisonView } from "@/components/comparison-view"
import { EmptyState } from "@/components/ui/empty-state"
import { PageHeader } from "@/components/ui/page-header"
import { CandidateSearchInput } from "@/components/candidate-search-input"
import { GitCompare, Sparkles, Loader2, Plus, Trash2, Users } from "lucide-react"
import { compareCandidates, batchCandidates, type Candidate } from "@/lib/api"

interface SelectedCandidate {
  id: string
  full_name?: string
  current_title?: string
  current_company?: string
}

export default function ComparePage() {
  const [jdText, setJdText] = useState("")
  const [selectedCandidates, setSelectedCandidates] = useState<(SelectedCandidate | null)[]>([null, null])
  const [comparison, setComparison] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [foundCandidates, setFoundCandidates] = useState<Map<string, Candidate>>(new Map())

  function updateSelection(index: number, candidate: SelectedCandidate | null) {
    const next = [...selectedCandidates]
    next[index] = candidate
    setSelectedCandidates(next)
  }

  function addRow() {
    setSelectedCandidates([...selectedCandidates, null])
  }

  function removeRow(index: number) {
    if (selectedCandidates.length <= 2) return
    setSelectedCandidates(selectedCandidates.filter((_, i) => i !== index))
  }

  const allSelected = selectedCandidates.every((c) => c !== null)

  async function handleCompare() {
    if (!jdText.trim() || !allSelected) {
      setError("Please fill in all fields")
      return
    }
    const ids = selectedCandidates.map((c) => c!.id)
    setLoading(true)
    setError("")

    try {
      const batchRes = await batchCandidates(ids)
      const nameMap = new Map<string, Candidate>()
      if (batchRes.success && batchRes.data) {
        for (const candidate of batchRes.data) {
          nameMap.set(candidate.id, candidate)
        }
      }
      setFoundCandidates(nameMap)

      const compareRes = await compareCandidates(jdText, ids)
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
    <div className="p-6 lg:p-8 max-w-5xl">
      <PageHeader
        icon={GitCompare}
        title="Compare Candidates"
        description="Side-by-side AI-powered candidate comparison"
      />

      <div className="bg-white rounded-xl border border-border p-5 space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Job Description</label>
          <div className="relative">
            <Sparkles className="absolute left-3 top-2.5 h-4 w-4 text-primary" />
            <textarea
              placeholder="Paste job description for comparison context..."
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              rows={2}
              className="w-full bg-muted/30 text-sm text-foreground placeholder-muted-foreground/60 outline-none rounded-lg border border-input pl-9 pr-3 py-2.5 focus:border-ring/40 focus:ring-1 focus:ring-ring/20 transition-colors resize-none"
            />
          </div>
        </div>

        <div className="space-y-2">
          {selectedCandidates.map((selected, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[11px] font-medium text-primary">
                {index + 1}
              </div>
              <CandidateSearchInput
                index={index}
                selected={selected}
                onSelect={(c) => updateSelection(index, c)}
              />
              {selectedCandidates.length > 2 && (
                <button
                  onClick={() => removeRow(index)}
                  className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted/60 transition-colors"
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
            disabled={loading || !allSelected}
            size="sm"
            className="ml-auto"
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
      </div>

      {loading && (
        <div className="mt-6 bg-white rounded-xl border border-border p-5 space-y-3">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-5/6" />
        </div>
      )}

      {comparison && !loading && (
        <div className="mt-6">
          <ComparisonView
            comparison={comparison}
            candidates={foundCandidates}
            candidateIds={selectedCandidates.map((c) => c!.id)}
          />
        </div>
      )}

      {!loading && !comparison && !error && (
        <div className="mt-6">
          <EmptyState
            icon={Users}
            title="Compare Candidates"
            description="Search and select candidates, then add a job description to get an AI-powered side-by-side comparison with score breakdowns."
          />
        </div>
      )}
    </div>
  )
}
