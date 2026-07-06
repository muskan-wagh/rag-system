"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X,
  Loader2,
  Copy,
  Check,
  Brain,
  Target,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  ArrowRight,
  AlertTriangle,
  Sparkles,
} from "lucide-react"
import { FlightRiskBadge } from "./flight-risk-badge"
import { apiFetch } from "@/lib/api-fetch"

interface CandidateDetail {
  id: string
  full_name?: string
  current_company?: string
  total_experience_years?: number
  email?: string
  phone?: string
  location?: string
  raw_resume_text?: string
  flight_risk?: string
  growth_trajectory?: string
  skills?: string[]
  match_score?: number
}

interface CandidateDetailModalProps {
  open: boolean
  onClose: () => void
  candidate: CandidateDetail | null
}

type Tab = "screening" | "closing"

interface ScreeningQuestion {
  question: string
  focus_area: string
  why_this_matters: string
}

interface ClosingStrategy {
  selling_points: Array<{ point: string; detail: string }>
  major_objection: { objection: string; overcome_strategy: string }
}

export function CandidateDetailModal({ open, onClose, candidate }: CandidateDetailModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("screening")
  const [screeningQuestions, setScreeningQuestions] = useState<ScreeningQuestion[] | null>(null)
  const [closingStrategy, setClosingStrategy] = useState<ClosingStrategy | null>(null)
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [loadingStrategy, setLoadingStrategy] = useState(false)
  const [copiedQuestions, setCopiedQuestions] = useState(false)
  const [questionsError, setQuestionsError] = useState("")
  const [strategyError, setStrategyError] = useState("")

  if (!candidate) return null

  const initials = (candidate.full_name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const generateQuestions = async () => {
    setLoadingQuestions(true)
    setQuestionsError("")
    try {
      const res = await apiFetch(`/api/candidates/${candidate.id}/screening-questions`, {
        method: "POST",
      })
      const data = await res.json()
      if (data.success && data.data?.questions) {
        setScreeningQuestions(data.data.questions)
      } else {
        setQuestionsError(data.error || "Failed to generate questions")
      }
    } catch {
      setQuestionsError("Failed to connect to server")
    } finally {
      setLoadingQuestions(false)
    }
  }

  const generateStrategy = async () => {
    setLoadingStrategy(true)
    setStrategyError("")
    try {
      const res = await apiFetch(`/api/candidates/${candidate.id}/closing-strategy`, {
        method: "POST",
      })
      const data = await res.json()
      if (data.success && data.data?.selling_points) {
        setClosingStrategy(data.data)
      } else {
        setStrategyError(data.error || "Failed to generate strategy")
      }
    } catch {
      setStrategyError("Failed to connect to server")
    } finally {
      setLoadingStrategy(false)
    }
  }

  const copyQuestions = async () => {
    if (!screeningQuestions) return
    const text = screeningQuestions
      .map((q, i) => `${i + 1}. ${q.question}\n   Focus: ${q.focus_area}`)
      .join("\n\n")

    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const input = document.createElement("textarea")
      input.value = text
      document.body.appendChild(input)
      input.select()
      document.execCommand("copy")
      document.body.removeChild(input)
    }
    setCopiedQuestions(true)
    setTimeout(() => setCopiedQuestions(false), 2000)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl border border-border shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col"
          >
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                  {initials}
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    {candidate.full_name || "Unknown"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {candidate.current_company || "Company not listed"}
                    {candidate.total_experience_years
                      ? ` · ${candidate.total_experience_years} yrs`
                      : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {candidate.flight_risk && <FlightRiskBadge risk={candidate.flight_risk} />}
                <button
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex border-b border-border">
              <button
                onClick={() => setActiveTab("screening")}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs font-medium transition-colors ${
                  activeTab === "screening"
                    ? "text-primary border-b-2 border-primary bg-primary/5"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                AI Screening Questions
              </button>
              <button
                onClick={() => setActiveTab("closing")}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs font-medium transition-colors ${
                  activeTab === "closing"
                    ? "text-primary border-b-2 border-primary bg-primary/5"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Target className="h-3.5 w-3.5" />
                Closing Strategy
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {activeTab === "screening" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-foreground">Pre-Screening Questions</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        AI-generated questions to verify claimed skills
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {screeningQuestions && (
                        <button
                          onClick={copyQuestions}
                          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {copiedQuestions ? (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              Copy All
                            </>
                          )}
                        </button>
                      )}
                      <button
                        onClick={generateQuestions}
                        disabled={loadingQuestions}
                        className="flex items-center gap-1.5 rounded-lg bg-primary text-white px-3 py-1.5 text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        {loadingQuestions ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        {loadingQuestions ? "Generating..." : "Generate"}
                      </button>
                    </div>
                  </div>

                  {questionsError && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600">
                      {questionsError}
                    </div>
                  )}

                  {loadingQuestions && (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="animate-pulse bg-muted rounded-xl h-20" />
                      ))}
                    </div>
                  )}

                  {screeningQuestions && !loadingQuestions && (
                    <div className="space-y-3">
                      {screeningQuestions.map((q, i) => (
                        <div key={i} className="bg-muted/30 rounded-xl p-4 border border-border">
                          <div className="flex items-start gap-3">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">
                              {i + 1}
                            </span>
                            <div>
                              <p className="text-sm text-foreground">{q.question}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <span className="rounded-full bg-primary/5 px-2 py-0.5 text-[10px] text-primary">
                                  {q.focus_area}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {q.why_this_matters}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!screeningQuestions && !loadingQuestions && !questionsError && (
                    <div className="text-center py-8">
                      <Brain className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">
                        Click &quot;Generate&quot; to create AI-powered screening questions based on this candidate&apos;s resume.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "closing" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-foreground">Closing Strategy</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Negotiation intel to help close the offer
                      </p>
                    </div>
                    <button
                      onClick={generateStrategy}
                      disabled={loadingStrategy}
                      className="flex items-center gap-1.5 rounded-lg bg-primary text-white px-3 py-1.5 text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {loadingStrategy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      {loadingStrategy ? "Generating..." : "Get Strategy"}
                    </button>
                  </div>

                  {strategyError && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600">
                      {strategyError}
                    </div>
                  )}

                  {loadingStrategy && (
                    <div className="space-y-3">
                      {Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="animate-pulse bg-muted rounded-xl h-24" />
                      ))}
                    </div>
                  )}

                  {closingStrategy && !loadingStrategy && (
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-3">
                          <ThumbsUp className="h-3.5 w-3.5 text-green-600" />
                          Selling Points
                        </h4>
                        <div className="space-y-2">
                          {closingStrategy.selling_points.map((sp, i) => (
                            <div key={i} className="bg-green-50/50 rounded-xl p-4 border border-green-200">
                              <p className="text-sm font-medium text-green-800">{sp.point}</p>
                              <p className="text-xs text-green-600 mt-1">{sp.detail}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-3">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                          Major Objection to Overcome
                        </h4>
                        <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-200">
                          <p className="text-sm font-medium text-amber-800">
                            {closingStrategy.major_objection.objection}
                          </p>
                          <p className="text-xs text-amber-600 mt-2 flex items-start gap-1.5">
                            <ArrowRight className="h-3 w-3 shrink-0 mt-0.5" />
                            {closingStrategy.major_objection.overcome_strategy}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {!closingStrategy && !loadingStrategy && !strategyError && (
                    <div className="text-center py-8">
                      <Target className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">
                        Click &quot;Get Strategy&quot; to generate a personalized closing strategy with selling points and objection handling.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
              <button className="flex items-center gap-1.5 rounded-lg border border-green-200 text-green-700 px-3 py-1.5 text-xs font-medium hover:bg-green-50 transition-colors">
                <ThumbsUp className="h-3.5 w-3.5" />
                Shortlist
              </button>
              <button className="flex items-center gap-1.5 rounded-lg border border-blue-200 text-blue-700 px-3 py-1.5 text-xs font-medium hover:bg-blue-50 transition-colors">
                <ArrowRight className="h-3.5 w-3.5" />
                Move to Interview
              </button>
              <button className="flex items-center gap-1.5 rounded-lg border border-red-200 text-red-700 px-3 py-1.5 text-xs font-medium hover:bg-red-50 transition-colors">
                <ThumbsDown className="h-3.5 w-3.5" />
                Reject
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
