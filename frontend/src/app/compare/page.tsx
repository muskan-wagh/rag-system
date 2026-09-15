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
import { GitCompare, Loader2, Plus, X, Sparkles, Briefcase } from "lucide-react"
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
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } },
}

function CompareSkeleton() {
  return (
    <div className="space-y-3" aria-label="Loading comparison">
      {/* best-fit skeleton */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      </div>
      {/* score cards skeleton */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center gap-2.5">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="size-14 shrink-0 rounded-full" />
            </div>
            <div className="mt-3 space-y-2">
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-2 w-5/6 rounded-full" />
              <Skeleton className="h-2 w-4/6 rounded-full" />
            </div>
          </div>
        ))}
      </div>
      {/* summary skeleton */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <Skeleton className="mb-2.5 h-3 w-36" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="mt-1.5 h-3 w-11/12" />
      </div>
    </div>
  )
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
      className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8"
    >
      {/* Compact header */}
      <motion.div variants={itemVariants} className="mb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-ink text-canvas shadow-sm">
            <GitCompare className="size-4" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <h1 className="text-[17px] font-semibold tracking-tight text-ink">
              Compare Candidates
            </h1>
            <p className="truncate text-[12.5px] text-muted">
              Side-by-side AI-powered candidate comparison
            </p>
          </div>
        </div>
      </motion.div>

      {/* Workspace: sticky setup rail + results column */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Setup rail */}
        <motion.aside variants={itemVariants} className="min-w-0 lg:sticky lg:top-6">
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-surface-secondary text-muted">
                <Briefcase className="size-3.5" strokeWidth={1.75} />
              </span>
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted">
                Setup
              </h2>
              {(loading || comparison) && (
                <span className="ml-auto rounded-full bg-success/10 px-2 py-0.5 text-[10.5px] font-semibold text-success">
                  {loading ? "Running…" : "Ready"}
                </span>
              )}
            </div>

            <div>
              <label htmlFor="compare-jd" className="mb-1.5 block text-[12px] font-medium text-muted">
                Job Description / Role
              </label>
              <textarea
                id="compare-jd"
                placeholder="Paste the job description or describe the role…"
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                rows={3}
                className="w-full resize-y rounded-lg border border-border bg-surface-secondary/40 px-3 py-2.5 text-[13px] leading-relaxed text-ink outline-none transition-colors placeholder:text-faint focus:border-border-hover focus:bg-surface"
              />
            </div>

            <p className="mb-1.5 mt-3 text-[12px] font-medium text-muted">Candidates</p>
            <div className="space-y-2">
              {selectedCandidates.map((selected, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-secondary font-data text-[11px] font-medium text-muted">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <CandidateSearchInput
                      index={index}
                      selected={selected}
                      onSelect={(c) => updateSelection(index, c)}
                    />
                  </div>
                  {selectedCandidates.length > 2 && (
                    <button
                      onClick={() => removeRow(index)}
                      aria-label="Remove candidate"
                      className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-secondary hover:text-danger"
                    >
                      <X className="size-3.5" strokeWidth={1.75} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-3 space-y-2">
              <Button
                onClick={handleCompare}
                disabled={loading || !allSelected || !jdText.trim()}
                className="h-9 w-full gap-1.5 text-[13px] font-semibold"
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                ) : (
                  <Sparkles className="size-4" strokeWidth={2} />
                )}
                {loading ? "Comparing..." : "Compare →"}
              </Button>
              <button
                onClick={addRow}
                className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg text-[12.5px] font-medium text-muted transition-colors hover:bg-surface-secondary hover:text-ink"
              >
                <Plus className="size-3.5" strokeWidth={1.75} />
                Add Candidate
              </button>
            </div>

            {error && (
              <p className="mt-2.5 flex items-center gap-1.5 text-[12px] text-danger">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-danger" />
                {error}
              </p>
            )}
          </div>
        </motion.aside>

        {/* Results column */}
        <div className="min-w-0">
          {loading && (
            <motion.div variants={itemVariants}>
              <CompareSkeleton />
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
            <motion.div variants={itemVariants} className="rounded-xl border border-dashed border-border bg-surface/60 lg:sticky lg:top-6">
              <EmptyState
                icon={Sparkles}
                title="Compare candidates"
                description="Select candidates and add a job description to see an AI-powered comparison."
              />
            </motion.div>
          )}
        </div>
      </div>

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
