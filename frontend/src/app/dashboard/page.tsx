"use client"

import { useState, useCallback } from "react"
import { motion } from "framer-motion"
import { Sparkles, Link2, RefreshCw, Loader2 } from "lucide-react"
import { GenerateLinkModal } from "@/components/generate-link-modal"
import { CandidateTable } from "@/components/candidate-table"
import { CandidateDetailModal } from "@/components/candidate-detail-modal"
import { apiFetch } from "@/lib/api-fetch"

interface SessionData {
  sessionId: string
  link: string
}

interface CandidateRow {
  id: string
  full_name?: string
  current_company?: string
  total_experience_years?: number
  flight_risk?: string
  growth_trajectory?: string
  match_score?: number
  email?: string
  phone?: string
  location?: string
  raw_resume_text?: string
  skills?: string[]
}

export default function DashboardPage() {
  const [jdText, setJdText] = useState("")
  const [session, setSession] = useState<SessionData | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [candidates, setCandidates] = useState<CandidateRow[]>([])
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateRow | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [error, setError] = useState("")

  const fetchCandidates = useCallback(
    async (sessionId?: string) => {
      const id = sessionId || session?.sessionId
      if (!id) return

      setLoadingCandidates(true)
      try {
        const res = await apiFetch(`/api/sessions/${id}`)

        const data = await res.json()
        if (data.success) {
          setCandidates(data.data?.candidates || [])
        }
      } catch {
        // silently fail for refresh
      } finally {
        setLoadingCandidates(false)
      }
    },
    [session],
  )

  const generateLink = useCallback(async () => {
    if (!jdText.trim()) return
    setGenerating(true)
    setError("")

    try {
      const res = await apiFetch(`/api/generate-link`, {
        method: "POST",
        body: JSON.stringify({ jdText }),
      })

      const data = await res.json()
      if (data.success) {
        setSession(data.data)
        setShowModal(true)
        fetchCandidates(data.data.sessionId)
      } else {
        setError(data.error || "Failed to generate link")
      }
    } catch {
      setError("Failed to connect to server")
    } finally {
      setGenerating(false)
    }
  }, [jdText, fetchCandidates])

  const handleSelectCandidate = (candidate: CandidateRow) => {
    setSelectedCandidate(candidate)
    setShowDetailModal(true)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 md:px-6 py-6 md:py-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground">Recruiter Dashboard</h1>
            <p className="text-xs text-muted-foreground">
              Create application links and manage candidate submissions
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-white rounded-2xl p-5 border border-border mb-6"
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">
              Job Description
            </label>
            <textarea
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder="Paste the job description here to generate an application link..."
              rows={4}
              className="w-full bg-muted/30 rounded-xl p-3 text-sm text-foreground placeholder-muted-foreground/60 outline-none resize-none border border-border focus:border-primary/40 transition-colors"
            />
          </div>

          {error && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <span className="inline-block h-1 w-1 rounded-full bg-destructive" />
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={generateLink}
              disabled={generating || !jdText.trim()}
              className="flex items-center gap-2 rounded-xl bg-primary text-white px-5 py-2.5 text-sm font-medium hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              {generating ? "Generating..." : "Generate Application Link"}
            </button>

            {session && (
              <button
                onClick={() => fetchCandidates()}
                disabled={loadingCandidates}
                className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingCandidates ? "animate-spin" : ""}`} />
                Refresh
                {candidates.length > 0 && (
                  <span className="ml-1 rounded-full bg-primary/5 px-1.5 py-0.5 text-[10px] text-primary">
                    {candidates.length}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {session && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-6"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="flex h-2 w-2 rounded-full bg-green-500" />
            <span className="text-xs font-medium text-green-700">Active Application Link</span>
          </div>
          <div className="flex items-center gap-2 bg-white rounded-xl border border-green-200 p-3">
            <code className="flex-1 text-xs text-green-800 break-all font-mono">
              {typeof window !== "undefined"
                ? `${window.location.origin}${session.link}`
                : session.link}
            </code>
            <button
              onClick={() => {
                const url =
                  typeof window !== "undefined"
                    ? `${window.location.origin}${session.link}`
                    : session.link
                navigator.clipboard.writeText(url)
              }}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 text-xs font-medium transition-colors"
            >
              <Link2 className="h-3.5 w-3.5" />
              Copy
            </button>
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">
            Candidates
            {candidates.length > 0 && (
              <span className="ml-1.5 text-muted-foreground font-normal">
                ({candidates.length})
              </span>
            )}
          </h2>
        </div>

        <CandidateTable
          candidates={candidates}
          loading={loadingCandidates}
          onSelect={handleSelectCandidate}
        />
      </motion.div>

      <CandidateDetailModal
        open={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        candidate={selectedCandidate}
      />

      <GenerateLinkModal
        open={showModal}
        onClose={() => setShowModal(false)}
        link={session?.link || ""}
        sessionId={session?.sessionId || ""}
      />
    </div>
  )
}
