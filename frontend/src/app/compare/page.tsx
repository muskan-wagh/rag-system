"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ComparisonView } from "@/components/comparison-view"
import { EmptyState } from "@/components/ui/empty-state"
import { CandidateSearchInput } from "@/components/candidate-search-input"
import { GitCompare, Sparkles, Loader2, Plus, Trash2, Users, Brain } from "lucide-react"
import { useApi } from "@/hooks/use-api"
import type { Candidate } from "@/lib/api"

interface SelectedCandidate {
  id: string
  full_name?: string
  current_title?: string
  current_company?: string
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const } },
}

export default function ComparePage() {
  const [jdText, setJdText] = useState("")
  const [selectedCandidates, setSelectedCandidates] = useState<(SelectedCandidate | null)[]>([null, null])
  const [comparison, setComparison] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [foundCandidates, setFoundCandidates] = useState<Map<string, Candidate>>(new Map())
  const api = useApi()

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
      const batchRes = await api.batchCandidates(ids)
      const nameMap = new Map<string, Candidate>()
      if (batchRes.success && batchRes.data) {
        for (const candidate of batchRes.data) nameMap.set(candidate.id, candidate)
      }
      setFoundCandidates(nameMap)
      const compareRes = await api.compareCandidates(jdText, ids)
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
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="pt-6 space-y-8"
    >
      <motion.div variants={itemVariants}>
        <h1 className="text-xl font-medium text-[#111111] tracking-tight">Compare Candidates</h1>
        <p className="text-sm text-[#6B7280] mt-1">Side-by-side AI-powered candidate comparison</p>
      </motion.div>

      <motion.div variants={itemVariants} className="bg-white rounded-[24px] border border-[#ECECEC] shadow-[0_10px_40px_rgba(0,0,0,0.05)] p-6 space-y-5">
        <div>
          <label className="text-xs font-medium text-[#6B7280] mb-2 block">Job Description</label>
          <div className="relative">
            <Brain className="absolute left-4 top-3.5 h-4 w-4 text-[#A3A3A3]" strokeWidth={1.5} />
            <textarea
              placeholder="Paste job description for comparison context..."
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              rows={2}
              className="w-full bg-white text-sm text-[#111111] placeholder:text-[#A3A3A3] outline-none rounded-[18px] border border-[#ECECEC] pl-10 pr-4 py-3 focus:border-[#111111] focus:shadow-[0_0_0_3px_rgba(17,17,17,0.06)] transition-all resize-none"
            />
          </div>
        </div>

        <div className="space-y-3">
          {selectedCandidates.map((selected, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F6F6F4] text-xs font-medium text-[#6B7280]">
                {index + 1}
              </div>
              <CandidateSearchInput
                index={index}
                selected={selected}
                onSelect={(c) => updateSelection(index, c)}
              />
              {selectedCandidates.length > 2 && (
                <button onClick={() => removeRow(index)}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#F6F6F4] transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5 text-[#A3A3A3] hover:text-[#EF4444]" strokeWidth={1.5} />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button variant="ghost" onClick={addRow} size="sm">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Candidate
          </Button>
          <Button onClick={handleCompare} disabled={loading || !allSelected} size="sm" className="ml-auto bg-[#111111] text-white hover:bg-[#2A2A2A]">
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <GitCompare className="h-3.5 w-3.5 mr-1.5" />
            )}
            {loading ? "Comparing..." : "Compare"}
          </Button>
        </div>

        {error && (
          <p className="text-xs text-[#EF4444] flex items-center gap-1.5">
            <span className="inline-block h-1 w-1 rounded-full bg-[#EF4444]" />
            {error}
          </p>
        )}
      </motion.div>

      {loading && (
        <motion.div variants={itemVariants} className="bg-white rounded-[24px] border border-[#ECECEC] p-6 space-y-3">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-5/6" />
        </motion.div>
      )}

      {comparison && !loading && (
        <motion.div variants={itemVariants}>
          <ComparisonView
            comparison={comparison}
            candidates={foundCandidates}
            candidateIds={selectedCandidates.map((c) => c!.id)}
          />
        </motion.div>
      )}

      {!loading && !comparison && !error && (
        <motion.div variants={itemVariants}>
          <EmptyState
            icon={GitCompare}
            title="Compare Candidates"
            description="Search and select candidates, then add a job description to get an AI-powered side-by-side comparison with score breakdowns."
          />
        </motion.div>
      )}
    </motion.div>
  )
}
