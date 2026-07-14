"use client"

import { useState, useEffect, useCallback, startTransition } from "react"
import {
  X, Loader2, Brain, Target, ThumbsUp, ArrowRight,
  AlertTriangle, Sparkles, FileText, CheckCircle2,
  User, Mail, Phone, MapPin, Briefcase, ExternalLink,
  Wand2, MessageSquare, ListChecks, Calendar, XCircle,
} from "lucide-react"
import { toast } from "sonner"
import {
  updateCandidateStatus,
  addCandidateNote,
  getCandidateNotes,
  getScreeningQuestions,
  getClosingStrategy,
  acceptOffer,
  sendInterviewEmail,
} from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs"
import { ScheduleInterviewModal } from "@/components/schedule-interview-modal"
import { RejectModal } from "@/components/reject-modal"
import { MakeOfferModal } from "@/components/make-offer-modal"
import { CandidateTimeline } from "@/components/candidate-timeline"

interface CandidateDetail {
  id: string
  full_name?: string
  current_company?: string
  current_title?: string
  total_experience_years?: number
  email?: string
  phone?: string
  location?: string
  raw_resume_text?: string
  flight_risk?: string
  growth_trajectory?: string
  skills?: string[]
  match_score?: number
  current_status?: string
  resume_file_url?: string
}

interface CandidateDetailModalProps {
  open: boolean
  onClose: () => void
  candidate: CandidateDetail | null
  onStatusChange?: () => void
}

interface ScreeningQuestion {
  question: string
  focus_area: string
  why_this_matters: string
}

interface ClosingStrategy {
  selling_points: Array<{ point: string; detail: string }>
  major_objection: { objection: string; overcome_strategy: string }
}

interface Note {
  id: string
  note_text: string
  created_at: string
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function getFlightRiskVariant(risk?: string): "destructive" | "default" | "outline" {
  if (risk === "High") return "destructive"
  if (risk === "Medium") return "default"
  return "outline"
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  } catch {
    return dateStr
  }
}

function getStatusColor(status?: string): string {
  const s = (status || "").toLowerCase()
  if (s === "applied") return "bg-blue-100 text-blue-700 border-blue-200"
  if (s === "shortlisted") return "bg-purple-100 text-purple-700 border-purple-200"
  if (s === "screening") return "bg-orange-100 text-orange-700 border-orange-200"
  if (s === "interview scheduled" || s === "interview completed" || s === "technical round" || s === "hr round") return "bg-yellow-100 text-yellow-700 border-yellow-200"
  if (s === "offered") return "bg-green-100 text-green-700 border-green-200"
  if (s === "hired") return "bg-emerald-100 text-emerald-700 border-emerald-200"
  if (s === "rejected") return "bg-red-100 text-red-700 border-red-200"
  return "bg-gray-100 text-gray-700 border-gray-200"
}

type TabId = "insights" | "profile" | "notes" | "generate" | "screening" | "closing"

export function CandidateDetailModal({ open, onClose, candidate, onStatusChange }: CandidateDetailModalProps) {
  const [screeningQuestions, setScreeningQuestions] = useState<ScreeningQuestion[] | null>(null)
  const [closingStrategy, setClosingStrategy] = useState<ClosingStrategy | null>(null)
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [loadingStrategy, setLoadingStrategy] = useState(false)
  const [questionsError, setQuestionsError] = useState("")
  const [strategyError, setStrategyError] = useState("")

  const [notes, setNotes] = useState<Note[]>([])
  const [loadingNotes, setLoadingNotes] = useState(false)
  const [newNote, setNewNote] = useState("")
  const [savingNote, setSavingNote] = useState(false)

  const [statusLoading, setStatusLoading] = useState(false)
  const [shortlisting, setShortlisting] = useState(false)
  const [movingToInterview, setMovingToInterview] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>("insights")

  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showOfferModal, setShowOfferModal] = useState(false)

  const fetchNotes = useCallback(async () => {
    if (!candidate) return
    setLoadingNotes(true)
    try {
      const result = await getCandidateNotes(candidate.id)
      if (result.success && result.data) {
        setNotes(result.data)
      }
    } catch {
    } finally {
      setLoadingNotes(false)
    }
  }, [candidate])

  useEffect(() => {
    if (open && candidate) {
      startTransition(() => {
        setScreeningQuestions(null)
        setClosingStrategy(null)
        setQuestionsError("")
        setStrategyError("")
        setNotes([])
        setNewNote("")
        setActiveTab("insights")
      })
      startTransition(() => {
        fetchNotes()
      })
    }
  }, [open, candidate, fetchNotes])

  const generateQuestions = useCallback(async () => {
    if (!candidate) return
    setLoadingQuestions(true)
    setQuestionsError("")
    try {
      const result = await getScreeningQuestions(candidate.id)
      if (result.success && result.data?.questions) {
        setScreeningQuestions(result.data.questions)
        setActiveTab("screening")
        toast.success("Screening questions generated!")
      } else {
        setQuestionsError(result.error || "Failed to generate questions")
      }
    } catch {
      setQuestionsError("Failed to connect to server")
      toast.error("Failed to generate screening questions")
    } finally {
      setLoadingQuestions(false)
    }
  }, [candidate])

  const generateStrategy = useCallback(async () => {
    if (!candidate) return
    setLoadingStrategy(true)
    setStrategyError("")
    try {
      const result = await getClosingStrategy(candidate.id)
      if (result.success && result.data?.selling_points) {
        setClosingStrategy(result.data)
        setActiveTab("closing")
        toast.success("Closing strategy generated!")
      } else {
        setStrategyError(result.error || "Failed to generate strategy")
      }
    } catch {
      setStrategyError("Failed to connect to server")
      toast.error("Failed to generate closing strategy")
    } finally {
      setLoadingStrategy(false)
    }
  }, [candidate])

  const handleGenerate = useCallback(async (type: "questions" | "strategy") => {
    if (type === "questions") {
      await generateQuestions()
    } else {
      await generateStrategy()
    }
  }, [generateQuestions, generateStrategy])

  const handleAddNote = async () => {
    if (!newNote.trim() || !candidate) return
    setSavingNote(true)
    try {
      await addCandidateNote(candidate.id, newNote.trim())
      setNewNote("")
      fetchNotes()
      toast.success("Note saved!")
    } catch {
      toast.error("Failed to save note")
    } finally {
      setSavingNote(false)
    }
  }

  const handleStatusChange = async (status: string) => {
    if (!candidate) return
    setStatusLoading(true)
    try {
      await updateCandidateStatus(candidate.id, status)
      onStatusChange?.()
      toast.success(`Candidate moved to ${status}!`)
    } catch {
      toast.error("Failed to update status")
    } finally {
      setStatusLoading(false)
    }
  }

  const handleAction = async (action: string) => {
    if (!candidate) return

    switch (action) {
      case "shortlisted":
      case "screening":
      case "interview-completed":
      case "technical-round":
      case "hr-round":
        await handleStatusChange(
          action === "interview-completed" ? "Interview Completed"
          : action === "shortlisted" ? "Shortlisted"
          : action === "screening" ? "Screening"
          : action === "technical-round" ? "Technical Round"
          : action === "hr-round" ? "HR Round"
          : action,
        )
        break
      case "schedule-interview":
        setShowScheduleModal(true)
        break
      case "reschedule":
        setShowScheduleModal(true)
        break
      case "send-reminder":
        setStatusLoading(true)
        try {
          const res = await sendInterviewEmail(candidate.id)
          if (res.success) {
            toast.success("Reminder email sent!")
          } else {
            toast.error(res.error || "Failed to send email")
          }
        } catch {
          toast.error("Failed to send email")
        } finally {
          setStatusLoading(false)
        }
        break
      case "make-offer":
        setShowOfferModal(true)
        break
      case "hired":
        setStatusLoading(true)
        try {
          await acceptOffer(candidate.id)
          onStatusChange?.()
          toast.success("Candidate marked as hired!")
        } catch {
          toast.error("Failed to mark as hired")
        } finally {
          setStatusLoading(false)
        }
        break
      case "reject":
        setShowRejectModal(true)
        break
    }
  }

  const handleShortlist = async () => {
    if (!candidate) return
    setShortlisting(true)
    try {
      await updateCandidateStatus(candidate.id, 'Screening')
      onStatusChange?.()
      toast.success('Candidate moved to Screening')
      onClose()
    } catch {
      toast.error('Failed to update status')
    } finally {
      setShortlisting(false)
    }
  }

  const handleMoveToInterview = async () => {
    if (!candidate) return
    setMovingToInterview(true)
    try {
      await updateCandidateStatus(candidate.id, 'Interview')
      onStatusChange?.()
      toast.success('Candidate moved to Interview')
      onClose()
    } catch {
      toast.error('Failed to update status')
    } finally {
      setMovingToInterview(false)
    }
  }

  const handleReject = async () => {
    if (!candidate) return
    setRejecting(true)
    try {
      await updateCandidateStatus(candidate.id, 'Rejected')
      onStatusChange?.()
      toast.success('Candidate moved to Rejected')
      onClose()
    } catch {
      toast.error('Failed to update status')
    } finally {
      setRejecting(false)
    }
  }

  const currentStatus = candidate?.current_status || "Applied"

  if (!candidate) return null

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-3xl max-h-[90vh] p-0 overflow-hidden flex flex-col
          sm:max-w-3xl sm:max-h-[90vh] sm:rounded-2xl
          max-sm:max-w-full max-sm:h-full max-sm:rounded-none max-sm:!top-0 max-sm:!left-0 max-sm:!translate-x-0 max-sm:!translate-y-0"
      >
        {/* Sticky Profile Header */}
        <div className="flex items-start justify-between p-6 border-b bg-muted/20 shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <Avatar className="h-14 w-14 shrink-0">
              <AvatarFallback className="text-lg">
                {getInitials(candidate.full_name || "?")}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h2 className="text-xl font-bold tracking-tight truncate">
                {candidate.full_name || "Unknown"}
              </h2>
              <p className="text-sm text-muted-foreground truncate">
                {candidate.current_title || ""}
                {(candidate.current_title && candidate.current_company ? " at " : "") + (candidate.current_company || "")}
                {candidate.total_experience_years ? ` · ${candidate.total_experience_years} yrs` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0 ml-4">
            {candidate.flight_risk && (
              <Badge variant={getFlightRiskVariant(candidate.flight_risk)}>
                {candidate.flight_risk} Risk
              </Badge>
            )}
            {currentStatus && (
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(currentStatus)}`}>
                {currentStatus}
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="px-6 border-b rounded-none justify-start bg-transparent h-12 overflow-x-auto shrink-0">
            <TabsTab value="insights" className="text-sm whitespace-nowrap">
              <Brain className="h-4 w-4 mr-1.5" />
              AI Insights
            </TabsTab>
            <TabsTab value="profile" className="text-sm whitespace-nowrap">
              <User className="h-4 w-4 mr-1.5" />
              Profile
            </TabsTab>
            <TabsTab value="notes" className="text-sm whitespace-nowrap">
              <FileText className="h-4 w-4 mr-1.5" />
              Notes
            </TabsTab>
            <TabsTab value="generate" className="text-sm whitespace-nowrap">
              <Wand2 className="h-4 w-4 mr-1.5" />
              Generate
            </TabsTab>
            <TabsTab value="screening" className="text-sm whitespace-nowrap">
              <MessageSquare className="h-4 w-4 mr-1.5" />
              Screening Questions
            </TabsTab>
            <TabsTab value="closing" className="text-sm whitespace-nowrap">
              <Target className="h-4 w-4 mr-1.5" />
              Closing Strategy
            </TabsTab>
          </TabsList>

          {/* AI Insights Tab */}
          <TabsPanel value="insights" className="flex-1 overflow-y-auto p-6 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-medium text-sm">Pre-Screening Questions</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    AI-generated questions to verify claimed skills
                  </p>
                </div>
                <Button size="sm" onClick={generateQuestions} disabled={loadingQuestions}>
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  {loadingQuestions ? "Generating..." : "Generate"}
                </Button>
              </div>

              {loadingQuestions && (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              )}

              {questionsError && (
                <Alert variant="destructive">
                  <AlertDescription className="flex items-center justify-between">
                    <span>{questionsError}</span>
                    <Button variant="ghost" size="xs" onClick={generateQuestions}>
                      Retry
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {screeningQuestions && !loadingQuestions && (
                <div className="space-y-2 mt-2">
                  {screeningQuestions.map((q, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg border"
                    >
                      <span className="font-mono text-xs text-muted-foreground mt-0.5 shrink-0">
                        #{i + 1}
                      </span>
                      <div>
                        <p className="text-sm">{q.question}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px]">{q.focus_area}</Badge>
                          <span className="text-[10px] text-muted-foreground">{q.why_this_matters}</span>
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
                    Click &quot;Generate&quot; to create AI-powered screening questions.
                  </p>
                </div>
              )}
            </div>

            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-medium text-sm">Closing Strategy</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Negotiation intel to help close the offer
                  </p>
                </div>
                <Button size="sm" onClick={generateStrategy} disabled={loadingStrategy}>
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  {loadingStrategy ? "Generating..." : "Get Strategy"}
                </Button>
              </div>

              {loadingStrategy && (
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-32 rounded-xl" />
                  <Skeleton className="h-32 rounded-xl" />
                </div>
              )}

              {strategyError && (
                <Alert variant="destructive">
                  <AlertDescription className="flex items-center justify-between">
                    <span>{strategyError}</span>
                    <Button variant="ghost" size="xs" onClick={generateStrategy}>
                      Retry
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {closingStrategy && !loadingStrategy && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg bg-green-50/50 dark:bg-green-950/10">
                    <h4 className="text-xs font-semibold text-green-600 uppercase tracking-wide">
                      <div className="flex items-center gap-1.5 mb-2">
                        <ThumbsUp className="h-3.5 w-3.5" />
                        Selling Points
                      </div>
                    </h4>
                    <ul className="space-y-1">
                      {closingStrategy.selling_points.map((sp, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-green-800">{sp.point}</p>
                            <p className="text-xs text-green-600">{sp.detail}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg bg-amber-50/50 dark:bg-amber-950/10">
                    <h4 className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
                      <div className="flex items-center gap-1.5 mb-2">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Objection to Overcome
                      </div>
                    </h4>
                    <p className="text-sm flex items-start gap-2 mt-1">
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <span className="font-medium text-amber-800">{closingStrategy.major_objection.objection}</span>
                    </p>
                    <p className="text-xs text-amber-600 mt-2 flex items-start gap-1.5 ml-6">
                      <ArrowRight className="h-3 w-3 shrink-0 mt-0.5" />
                      {closingStrategy.major_objection.overcome_strategy}
                    </p>
                  </div>
                </div>
              )}

              {!closingStrategy && !loadingStrategy && !strategyError && (
                <div className="text-center py-8">
                  <Target className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Click &quot;Get Strategy&quot; to generate selling points and objection handling.
                  </p>
                </div>
              )}
            </div>
          </TabsPanel>

          {/* Profile Tab */}
          <TabsPanel value="profile" className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {candidate.email && (
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-sm truncate">{candidate.email}</p>
                  </div>
                </div>
              )}
              {candidate.phone && (
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="text-sm">{candidate.phone}</p>
                  </div>
                </div>
              )}
              {candidate.location && (
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="text-sm">{candidate.location}</p>
                  </div>
                </div>
              )}
              {candidate.total_experience_years !== undefined && (
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border">
                  <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Experience</p>
                    <p className="text-sm">{candidate.total_experience_years} years</p>
                  </div>
                </div>
              )}
            </div>

            {candidate.skills && candidate.skills.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Skills</h4>
                <div className="flex flex-wrap gap-1.5">
                  {candidate.skills.map((skill, i) => (
                    <Badge key={i} variant="secondary">{skill}</Badge>
                  ))}
                </div>
              </div>
            )}

            {candidate.resume_file_url && (
              <div>
                <h4 className="text-sm font-medium mb-2">Resume File</h4>
                <a
                  href={candidate.resume_file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Original Resume
                </a>
              </div>
            )}

            {candidate.raw_resume_text && (
              <div>
                <h4 className="text-sm font-medium mb-2">Resume Text</h4>
                <div className="bg-muted/30 rounded-lg border p-4 max-h-48 overflow-y-auto">
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {candidate.raw_resume_text}
                  </p>
                </div>
              </div>
            )}
          </TabsPanel>

          {/* Notes Tab */}
          <TabsPanel value="notes" className="flex-1 overflow-y-auto p-6 space-y-4">
            <div>
              <h3 className="font-medium text-sm">Candidate Notes</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Internal notes about this candidate
              </p>
            </div>

            <div className="flex gap-2">
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add interview feedback or notes..."
                className="min-h-[100px]"
              />
            </div>
            <Button
              onClick={handleAddNote}
              disabled={!newNote.trim() || savingNote}
              className="mt-2"
            >
              {savingNote && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Save Note
            </Button>

            {loadingNotes && (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            )}

            {!loadingNotes && notes.length === 0 && (
              <div className="text-center py-8">
                <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No notes yet. Add one above.</p>
              </div>
            )}

            {notes.length > 0 && (
              <div className="space-y-2">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="p-3 bg-muted/30 rounded-lg text-sm border-l-4 border-primary/30"
                  >
                    <p>{note.note_text}</p>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      {formatDate(note.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </TabsPanel>

          {/* Generate Tab */}
          <TabsPanel value="generate" className="flex-1 overflow-y-auto p-6 space-y-6">
            <div>
              <h3 className="font-medium text-sm flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-primary" />
                AI Generation Hub
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Generate AI-powered insights for this candidate. Results appear in the respective tabs.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 border rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <MessageSquare className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium">Screening Questions</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Generate personalized verification questions based on the job description and resume.
                    </p>
                    <div className="mt-3">
                      {screeningQuestions ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          <span className="text-xs text-emerald-600 font-medium">
                            {screeningQuestions.length} questions ready
                          </span>
                          <Button variant="ghost" size="xs" onClick={() => setActiveTab("screening")}>
                            View
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleGenerate("questions")}
                          disabled={loadingQuestions}
                        >
                          {loadingQuestions ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5 mr-1" />
                          )}
                          {loadingQuestions ? "Generating..." : "Generate"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 border rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                    <Target className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium">Closing Strategy</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Generate selling points and objection handling strategies to close the offer.
                    </p>
                    <div className="mt-3">
                      {closingStrategy ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          <span className="text-xs text-emerald-600 font-medium">
                            Strategy ready
                          </span>
                          <Button variant="ghost" size="xs" onClick={() => setActiveTab("closing")}>
                            View
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleGenerate("strategy")}
                          disabled={loadingStrategy}
                        >
                          {loadingStrategy ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5 mr-1" />
                          )}
                          {loadingStrategy ? "Generating..." : "Get Strategy"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsPanel>

          {/* Screening Questions Tab */}
          <TabsPanel value="screening" className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-sm">Screening Questions</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  AI-generated questions to verify claimed skills
                </p>
              </div>
              <Button size="sm" onClick={generateQuestions} disabled={loadingQuestions}>
                <Sparkles className="h-3.5 w-3.5 mr-1" />
                {loadingQuestions ? "Generating..." : "Generate"}
              </Button>
            </div>

            {loadingQuestions && (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            )}

            {questionsError && (
              <Alert variant="destructive">
                <AlertDescription className="flex items-center justify-between">
                  <span>{questionsError}</span>
                  <Button variant="ghost" size="xs" onClick={generateQuestions}>
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {screeningQuestions && !loadingQuestions && (
              <div className="space-y-2">
                {screeningQuestions.map((q, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg border"
                  >
                    <span className="font-mono text-xs text-muted-foreground mt-0.5 shrink-0">
                      #{i + 1}
                    </span>
                    <div>
                      <p className="text-sm">{q.question}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px]">{q.focus_area}</Badge>
                        <span className="text-[10px] text-muted-foreground">{q.why_this_matters}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!screeningQuestions && !loadingQuestions && !questionsError && (
              <div className="text-center py-12">
                <MessageSquare className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  Generate screening questions from the Generate tab or click the button above.
                </p>
              </div>
            )}
          </TabsPanel>

          {/* Closing Strategy Tab */}
          <TabsPanel value="closing" className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-sm">Closing Strategy</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Negotiation intel to help close the offer
                </p>
              </div>
              <Button size="sm" onClick={generateStrategy} disabled={loadingStrategy}>
                <Sparkles className="h-3.5 w-3.5 mr-1" />
                {loadingStrategy ? "Generating..." : "Get Strategy"}
              </Button>
            </div>

            {loadingStrategy && (
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-32 rounded-xl" />
                <Skeleton className="h-32 rounded-xl" />
              </div>
            )}

            {strategyError && (
              <Alert variant="destructive">
                <AlertDescription className="flex items-center justify-between">
                  <span>{strategyError}</span>
                  <Button variant="ghost" size="xs" onClick={generateStrategy}>
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {closingStrategy && !loadingStrategy && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg bg-green-50/50 dark:bg-green-950/10">
                  <h4 className="text-xs font-semibold text-green-600 uppercase tracking-wide flex items-center gap-1.5 mb-3">
                    <ThumbsUp className="h-3.5 w-3.5" />
                    Selling Points
                  </h4>
                  <ul className="space-y-2">
                    {closingStrategy.selling_points.map((sp, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-green-800">{sp.point}</p>
                          <p className="text-xs text-green-600">{sp.detail}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-4 border rounded-lg bg-amber-50/50 dark:bg-amber-950/10">
                  <h4 className="text-xs font-semibold text-amber-600 uppercase tracking-wide flex items-center gap-1.5 mb-3">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Objection to Overcome
                  </h4>
                  <p className="text-sm flex items-start gap-2 mt-1">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <span className="font-medium text-amber-800">{closingStrategy.major_objection.objection}</span>
                  </p>
                  <p className="text-xs text-amber-600 mt-2 flex items-start gap-1.5 ml-6">
                    <ArrowRight className="h-3 w-3 shrink-0 mt-0.5" />
                    {closingStrategy.major_objection.overcome_strategy}
                  </p>
                </div>
              </div>
            )}

            {!closingStrategy && !loadingStrategy && !strategyError && (
              <div className="text-center py-12">
                <Target className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  Generate a closing strategy from the Generate tab or click the button above.
                </p>
              </div>
            )}
          </TabsPanel>
        </Tabs>

        {/* Pipeline Action Footer */}
        <div className="sticky bottom-0 flex flex-col gap-3 p-4 border-t bg-white shrink-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Next Step</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleShortlist}
                disabled={shortlisting || currentStatus === 'Rejected'}
              >
                {shortlisting ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <ListChecks className="h-3.5 w-3.5 mr-1" />
                )}
                {shortlisting ? 'Updating...' : 'Shortlist'}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleMoveToInterview}
                disabled={movingToInterview || currentStatus === 'Rejected'}
              >
                {movingToInterview ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Calendar className="h-3.5 w-3.5 mr-1" />
                )}
                {movingToInterview ? 'Updating...' : 'Move to Interview'}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleReject}
                disabled={rejecting || currentStatus === 'Rejected'}
              >
                {rejecting ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                )}
                {rejecting ? 'Updating...' : 'Reject'}
              </Button>
            </div>
          </div>
          <CandidateTimeline candidateId={candidate.id} />
        </div>

        {/* Close button override */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </DialogContent>

      <ScheduleInterviewModal
        open={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        candidateId={candidate.id}
        onSuccess={onStatusChange}
      />

      <RejectModal
        open={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        candidateId={candidate.id}
        onSuccess={onStatusChange}
      />

      <MakeOfferModal
        open={showOfferModal}
        onClose={() => setShowOfferModal(false)}
        candidateId={candidate.id}
        onSuccess={onStatusChange}
      />
    </Dialog>
  )
}
