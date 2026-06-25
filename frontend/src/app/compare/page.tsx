"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { GitCompare, Trash2, Plus, Sparkles, Loader2 } from "lucide-react"
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
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-purple-600 to-blue-600">
              <GitCompare className="h-3 w-3 text-white" />
            </div>
            <h1 className="text-lg font-semibold text-white">Compare Candidates</h1>
          </div>
          <p className="text-xs text-white/40">
            Compare multiple candidates side-by-side for the same job description
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-5 ring-1 ring-white/[0.06] space-y-4"
        >
          <div>
            <label className="text-xs font-medium text-white/60 mb-1.5 block">Job Description</label>
            <div className="relative">
              <Sparkles className="absolute left-3 top-2.5 h-3.5 w-3.5 text-purple-400" />
              <textarea
                placeholder="Paste job description..."
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                rows={2}
                className="w-full bg-white/[0.03] text-sm text-white placeholder-white/30 outline-none resize-none rounded-xl border border-white/[0.06] pl-8 pr-3 py-2 focus:border-purple-500/30 transition-colors"
              />
            </div>
          </div>

          <div className="space-y-2">
            {candidateIds.map((id, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-white/40 mb-1 block">
                    Candidate {index + 1}
                    {foundCandidates.has(id) && (
                      <span className="ml-2 text-purple-400">
                        — {foundCandidates.get(id)?.name}
                      </span>
                    )}
                  </label>
                  <input
                    placeholder="Candidate ID (e.g., cand-001)"
                    value={id}
                    onChange={(e) => updateId(index, e.target.value)}
                    className="w-full bg-white/[0.03] text-sm text-white placeholder-white/20 outline-none rounded-xl border border-white/[0.06] px-3 py-2 focus:border-purple-500/30 transition-colors"
                  />
                </div>
                {candidateIds.length > 2 && (
                  <button
                    onClick={() => removeRow(index)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/[0.06] transition-colors mt-4"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-white/30 hover:text-red-400" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={addRow}
              className="text-white/50 hover:text-white text-xs h-8"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Candidate
            </Button>
            <Button
              onClick={handleCompare}
              disabled={loading}
              className="bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-500 hover:to-blue-500 h-8 px-4 text-xs ml-auto"
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
            <p className="text-xs text-red-400 flex items-center gap-1">
              <span className="inline-block h-1 w-1 rounded-full bg-red-400" />
              {error}
            </p>
          )}
        </motion.div>

        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 glass rounded-2xl p-5 ring-1 ring-white/[0.06] space-y-3"
          >
            <Skeleton className="h-3 w-full bg-white/[0.06]" />
            <Skeleton className="h-3 w-3/4 bg-white/[0.06]" />
            <Skeleton className="h-3 w-1/2 bg-white/[0.06]" />
            <Skeleton className="h-3 w-5/6 bg-white/[0.06]" />
          </motion.div>
        )}

        {comparison && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6 glass rounded-2xl ring-1 ring-white/[0.06] overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-400" />
                <h2 className="text-sm font-medium text-white">Comparison Results</h2>
              </div>
            </div>
            <ScrollArea className="max-h-[500px]">
              <div className="p-5">
                <div className="prose prose-sm max-w-none prose-invert whitespace-pre-wrap text-xs text-white/60 leading-relaxed">
                  {comparison}
                </div>
              </div>
            </ScrollArea>
          </motion.div>
        )}

        {!loading && !comparison && !error && !jdText && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-6 glass rounded-2xl p-14 text-center ring-1 ring-white/[0.06]"
          >
            <div className="flex justify-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600/20 to-blue-600/20 ring-1 ring-white/[0.06]">
                <GitCompare className="h-5 w-5 text-purple-400" />
              </div>
            </div>
            <h3 className="text-sm font-medium text-white mb-2">Compare Candidates</h3>
            <p className="text-xs text-white/40 max-w-xs mx-auto">
              Add candidate IDs and a job description to get an AI-powered side-by-side comparison.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  )
}
