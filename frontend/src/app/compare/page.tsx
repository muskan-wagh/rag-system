"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ComparisonView } from "@/components/comparison-view"
import { EmptyState } from "@/components/ui/empty-state"
import { CandidateSearchInput } from "@/components/candidate-search-input"
import { ScheduleInterviewModal } from "@/components/schedule-interview-modal"
import { RejectModal } from "@/components/reject-modal"
import { GmailOutreachModal } from "@/components/gmail-outreach-modal"
import { PageHeader } from "@/components/ui/page-header"
import { GitCompare, Loader2, Plus, Trash2, Brain, Sparkles } from "lucide-react"
import { useApi } from "@/hooks/use-api"
import type { CompareResult } from "@/lib/api"

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
  const [comparison, setComparison] = useState<CompareResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [modalState, setModalState] = useState<{
    type: "schedule" | "reject" | null
    candidateId: string
    candidateName: string
  }>({ type: null, candidateId: "", candidateName: "" })
  const [emailCandidate, setEmailCandidate] = useState<{ id: string; name: string } | null>(null)
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
      const compareRes = await api.compareCandidates(jdText, ids)
      if (compareRes.success && compareRes.data) {
        setComparison(compareRes.data.comparison)
      } else {
        setError(compareRes.error || "Comparison failed")
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setError("Comparison timed out. Please try again.")
      } else {
        setError("Failed to connect to server. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleShortlist(candidateId: string, name: string) {
    try {
      const res = await api.updateCandidateStatus(candidateId, "screening")
      if (res.success) {
        toast.success(`${name} moved to Screening`)
      } else {
        toast.error(res.error || "Failed to shortlist")
      }
    } catch {
      toast.error("Failed to shortlist candidate")
    }
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

  async function handleEmail(candidateId: string, name: string) {
    // Open the Gmail outreach composer — recipient/subject/body are resolved
    // by the backend from the candidate record; nothing is sent automatically.
    setEmailCandidate({ id: candidateId, name })
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="pt-6 space-y-8"
    >
      <PageHeader
        title="Compare Candidates"
        description="Side-by-side AI-powered candidate comparison"
      />

      <motion.div variants={itemVariants} className="bg-surface rounded-lg border border-border shadow-none p-6 space-y-5">
        <div>
          <label className="text-xs font-medium text-muted mb-2 block">Job Description</label>
          <div className="relative">
            <Brain className="absolute left-4 top-3.5 h-4 w-4 text-faint" strokeWidth={1.5} />
            <textarea
              placeholder="Paste job description for comparison context..."
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              rows={3}
              className="w-full bg-surface text-sm text-ink placeholder:text-faint outline-none rounded-lg border border-border pl-10 pr-4 py-3 focus:border-border-hover transition-all resize-y min-h-[80px]"
            />
          </div>
        </div>

        <div className="space-y-3">
          {selectedCandidates.map((selected, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-xs font-medium text-muted">
                {index + 1}
              </div>
              <CandidateSearchInput
                index={index}
                selected={selected}
                onSelect={(c) => updateSelection(index, c)}
              />
              {selectedCandidates.length > 2 && (
                <button onClick={() => removeRow(index)}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-secondary transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5 text-faint hover:text-danger" strokeWidth={1.5} />
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
          <Button onClick={handleCompare} disabled={loading || !allSelected} size="sm" className="ml-auto bg-ink text-canvas hover:bg-ink/90">
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            )}
            {loading ? "Comparing..." : "Compare"}
          </Button>
        </div>

        {error && (
          <p className="text-xs text-danger flex items-center gap-1.5">
            <span className="inline-block h-1 w-1 rounded-full bg-danger" />
            {error}
          </p>
        )}
      </motion.div>

      {loading && (
        <motion.div variants={itemVariants} className="space-y-5">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <div className="flex gap-5">
            <Skeleton className="h-64 flex-1 rounded-2xl" />
            <Skeleton className="h-64 flex-1 rounded-2xl" />
          </div>
          <Skeleton className="h-48 w-full rounded-2xl" />
        </motion.div>
      )}

      {comparison && !loading && (
        <motion.div variants={itemVariants}>
          <ComparisonView
            result={comparison}
            onScheduleInterview={(id, name) => setModalState({ type: "schedule", candidateId: id, candidateName: name })}
            onAddToPool={handleAddToPool}
            onEmail={handleEmail}
            onShortlist={handleShortlist}
            onReject={(id, name) => setModalState({ type: "reject", candidateId: id, candidateName: name })}
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

      <ScheduleInterviewModal
        open={modalState.type === "schedule"}
        onClose={() => setModalState({ type: null, candidateId: "", candidateName: "" })}
        candidateId={modalState.candidateId}
      />

      <RejectModal
        open={modalState.type === "reject"}
        onClose={() => setModalState({ type: null, candidateId: "", candidateName: "" })}
        candidateId={modalState.candidateId}
      />

      {emailCandidate && (
        <GmailOutreachModal
          open
          onClose={() => setEmailCandidate(null)}
          candidateId={emailCandidate.id}
          candidateName={emailCandidate.name}
          candidateEmail=""
        />
      )}
    </motion.div>
  )
}
