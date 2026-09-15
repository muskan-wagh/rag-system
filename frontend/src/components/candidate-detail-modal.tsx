"use client"

import { useState, useEffect, useCallback, startTransition } from "react"
import {
  Loader2, ThumbsUp, ArrowRight,
  AlertTriangle, Sparkles, FileText, CircleCheck,
  User, Mail, Phone, MapPin, Briefcase, ExternalLink,
  MessageSquare, Calendar, CircleX, Search,
  Clock3, Target, Tag, Hash,
} from "lucide-react"
import { toast } from "sonner"
import { useApi } from "@/hooks/use-api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { StatusDot } from "@/components/ui/status-dot"
import { getStatusColor, getInitials, formatDate } from "@/lib/constants"
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs"
import { ScheduleInterviewModal } from "@/components/schedule-interview-modal"
import { RejectModal } from "@/components/reject-modal"
import { MakeOfferModal } from "@/components/make-offer-modal"
import { GmailOutreachModal } from "@/components/gmail-outreach-modal"
import { GmailLogo } from "@/components/gmail-logo"
import { CandidateTimeline } from "@/components/candidate-timeline"
import { cn } from "@/lib/utils"

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
  created_at?: string
  upload_session_id?: string
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

function getFlightRiskVariant(risk?: string): "destructive" | "default" | "outline" {
  if (risk === "High") return "destructive"
  if (risk === "Medium") return "default"
  return "outline"
}

type TabId = "profile" | "timeline" | "insights" | "notes" | "screening" | "closing"

const TABS: Array<{ id: TabId; label: string; icon: typeof User }> = [
  { id: "profile", label: "Profile", icon: User },
  { id: "timeline", label: "Timeline", icon: Clock3 },
  { id: "insights", label: "Insights", icon: Sparkles },
  { id: "notes", label: "Notes", icon: FileText },
  { id: "screening", label: "Screening Questions", icon: Search },
  { id: "closing", label: "Closing Strategy", icon: Target },
]

function Section({
  icon: Icon,
  title,
  description,
  action,
  children,
}: {
  icon: typeof User
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-secondary text-muted">
            <Icon className="size-3.5" strokeWidth={1.75} />
          </span>
          <div>
            <h3 className="text-[13px] font-medium leading-tight text-ink">{title}</h3>
            {description && (
              <p className="mt-0.5 text-[11px] leading-tight text-faint">{description}</p>
            )}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function MetaRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof User
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
      <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-muted">
        <Icon className="size-3.5 shrink-0" strokeWidth={1.75} />
        {label}
      </span>
      <span className="min-w-0 text-right text-[12px] text-ink">{children}</span>
    </div>
  )
}

export function CandidateDetailModal({ open, onClose, candidate, onStatusChange }: CandidateDetailModalProps) {
  const api = useApi()
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

  const [shortlisting, setShortlisting] = useState(false)
  // Profile is the default landing tab — timeline only opens on explicit click.
  const [activeTab, setActiveTab] = useState<TabId>("profile")
  // Mirrors the candidate status locally so header actions via child
  // modals (schedule / offer / reject) reflect immediately while open.
  const [localStatus, setLocalStatus] = useState<string | undefined>(undefined)

  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showOfferModal, setShowOfferModal] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)

  const fetchNotes = useCallback(async () => {
    if (!candidate) return
    setLoadingNotes(true)
    try {
      const result = await api.getCandidateNotes(candidate.id)
      if (result.success && result.data) {
        setNotes(result.data)
      }
    } catch {
    } finally {
      setLoadingNotes(false)
    }
  }, [candidate, api])

  useEffect(() => {
    if (open && candidate) {
      startTransition(() => {
        setScreeningQuestions(null)
        setClosingStrategy(null)
        setQuestionsError("")
        setStrategyError("")
        setNotes([])
        setNewNote("")
        // Always land on Profile when a candidate is opened.
        setActiveTab("profile")
        setLocalStatus(candidate.current_status)
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
      const result = await api.getScreeningQuestions(candidate.id)
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
  }, [candidate, api])

  const generateStrategy = useCallback(async () => {
    if (!candidate) return
    setLoadingStrategy(true)
    setStrategyError("")
    try {
      const result = await api.getClosingStrategy(candidate.id)
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
  }, [candidate, api])

  const handleAddNote = async () => {
    if (!newNote.trim() || !candidate) return
    setSavingNote(true)
    try {
      await api.addCandidateNote(candidate.id, newNote.trim())
      setNewNote("")
      fetchNotes()
      toast.success("Note saved!")
    } catch {
      toast.error("Failed to save note")
    } finally {
      setSavingNote(false)
    }
  }

  const handleShortlist = async () => {
    if (!candidate) return
    setShortlisting(true)
    try {
      await api.updateCandidateStatus(candidate.id, 'Screening')
      onStatusChange?.()
      toast.success('Candidate moved to Screening')
      onClose()
    } catch {
      toast.error('Failed to update status')
    } finally {
      setShortlisting(false)
    }
  }

  const currentStatus = localStatus ?? candidate?.current_status ?? "Applied"
  const isTerminal = currentStatus === 'Rejected'
  const isHired = currentStatus === 'Hired'
  const hasAiSnapshot =
    candidate?.match_score !== undefined ||
    !!candidate?.flight_risk ||
    !!candidate?.growth_trajectory

  if (!candidate) return null

  const titleLine =
    (candidate.current_title || "") +
    (candidate.current_title && candidate.current_company ? " at " : "") +
    (candidate.current_company || "")

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="flex h-[min(92vh,880px)] max-h-[92vh] w-[calc(100%-2rem)] max-w-4xl flex-col overflow-hidden p-0
          max-sm:w-[calc(100%-1.5rem)] max-sm:max-w-full sm:rounded-2xl"
      >
        {/* Candidate header */}
        <div className="shrink-0 border-b border-border bg-surface px-4 pb-4 pt-5 sm:px-6">
          <div className="flex items-start gap-3.5 pr-8">
            <Avatar className="size-12 shrink-0">
              <AvatarFallback className="text-[15px] font-medium">
                {getInitials(candidate.full_name || "?")}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                <h2 className="truncate text-[16px] font-semibold tracking-tight text-ink">
                  {candidate.full_name || "Unknown"}
                </h2>
                <span className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                  getStatusColor(currentStatus),
                )}>
                  <StatusDot status={currentStatus} />
                  {currentStatus}
                </span>
                {candidate.flight_risk && (
                  <Badge variant={getFlightRiskVariant(candidate.flight_risk)} className="shrink-0">
                    {candidate.flight_risk} Risk
                  </Badge>
                )}
              </div>
              {(titleLine || candidate.total_experience_years) && (
                <p className="mt-1 truncate text-[12.5px] text-muted">
                  {titleLine}
                  {titleLine && candidate.total_experience_years ? " · " : ""}
                  {candidate.total_experience_years ? `${candidate.total_experience_years} yrs experience` : ""}
                </p>
              )}
            </div>
          </div>

          {/* Status actions */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleShortlist}
              disabled={shortlisting || isTerminal || currentStatus === 'Screening'}
              className="border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
            >
              {shortlisting ? (
                <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />
              ) : (
                <Search className="size-3.5" strokeWidth={1.75} />
              )}
              {shortlisting ? 'Updating...' : 'Screening'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowScheduleModal(true)}
              disabled={isTerminal}
              className="border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
            >
              <Calendar className="size-3.5" strokeWidth={1.75} />
              Schedule Interview
            </Button>
            <Button
              size="sm"
              onClick={() => setShowOfferModal(true)}
              disabled={isTerminal || isHired}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              <CircleCheck className="size-3.5" strokeWidth={1.75} />
              Hire
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRejectModal(true)}
              disabled={isTerminal}
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <CircleX className="size-3.5" strokeWidth={1.75} />
              Reject
            </Button>
            {candidate.email && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowEmailModal(true)}
                className="text-muted"
              >
                <GmailLogo className="size-3.5" />
                Send Email
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <TabsList className="h-12 shrink-0 justify-start gap-1 overflow-x-auto rounded-none border-b border-border bg-transparent px-3 sm:px-4">
            {TABS.map((tab) => (
              <TabsTab
                key={tab.id}
                value={tab.id}
                className="shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-[12.5px] data-selected:bg-surface-secondary data-selected:shadow-none"
              >
                <tab.icon className="mr-1.5 size-3.5" strokeWidth={1.75} />
                {tab.label}
              </TabsTab>
            ))}
          </TabsList>

          {/* Profile Tab (default) */}
          <TabsPanel value="profile" className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            <div className="grid items-start gap-4 lg:grid-cols-5">
              <div className="min-w-0 space-y-4 lg:col-span-3">
                <Section icon={User} title="Candidate Overview" description="Role, contact and background">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {candidate.email && (
                      <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-border p-2.5">
                        <Mail className="size-3.5 shrink-0 text-faint" strokeWidth={1.75} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] uppercase tracking-[0.05em] text-faint">Email</p>
                          <p className="truncate text-[12.5px] text-ink">{candidate.email}</p>
                        </div>
                      </div>
                    )}
                    {candidate.phone && (
                      <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-border p-2.5">
                        <Phone className="size-3.5 shrink-0 text-faint" strokeWidth={1.75} />
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-[0.05em] text-faint">Phone</p>
                          <p className="truncate text-[12.5px] text-ink">{candidate.phone}</p>
                        </div>
                      </div>
                    )}
                    {candidate.location && (
                      <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-border p-2.5">
                        <MapPin className="size-3.5 shrink-0 text-faint" strokeWidth={1.75} />
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-[0.05em] text-faint">Location</p>
                          <p className="truncate text-[12.5px] text-ink">{candidate.location}</p>
                        </div>
                      </div>
                    )}
                    {candidate.total_experience_years !== undefined && (
                      <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-border p-2.5">
                        <Briefcase className="size-3.5 shrink-0 text-faint" strokeWidth={1.75} />
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-[0.05em] text-faint">Experience</p>
                          <p className="text-[12.5px] text-ink">{candidate.total_experience_years} years</p>
                        </div>
                      </div>
                    )}
                  </div>
                  {!candidate.email && !candidate.phone && !candidate.location && candidate.total_experience_years === undefined && (
                    <p className="text-[12.5px] text-muted">No contact details on file.</p>
                  )}
                </Section>

                {candidate.skills && candidate.skills.length > 0 && (
                  <Section icon={Tag} title="Skills" description={`${candidate.skills.length} skills on record`}>
                    <div className="flex flex-wrap gap-1.5">
                      {candidate.skills.map((skill, i) => (
                        <span
                          key={i}
                          className="rounded-md bg-surface-secondary px-2 py-1 text-[11.5px] leading-none text-muted"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </Section>
                )}

                {(candidate.resume_file_url || candidate.raw_resume_text) && (
                  <Section icon={FileText} title="Resume" description="Application documents">
                    <div className="space-y-3">
                      {candidate.resume_file_url && (
                        <a
                          href={candidate.resume_file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-[12.5px] font-medium text-ink transition-colors hover:bg-surface-secondary"
                        >
                          <ExternalLink className="size-3.5" strokeWidth={1.75} />
                          Open Original Resume
                        </a>
                      )}
                      {candidate.raw_resume_text && (
                        <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-surface-secondary/50 p-3.5">
                          <p className="whitespace-pre-wrap text-[11.5px] leading-relaxed text-muted">
                            {candidate.raw_resume_text}
                          </p>
                        </div>
                      )}
                    </div>
                  </Section>
                )}
              </div>

              <div className="min-w-0 space-y-4 lg:col-span-2">
                <Section icon={Hash} title="Application Details" description="Hiring metadata">
                  <div className="divide-y divide-border">
                    <MetaRow icon={Clock3} label="Current stage">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        getStatusColor(currentStatus),
                      )}>
                        <StatusDot status={currentStatus} />
                        {currentStatus}
                      </span>
                    </MetaRow>
                    {candidate.created_at && (
                      <MetaRow icon={Calendar} label="Applied">
                        {formatDate(candidate.created_at)}
                      </MetaRow>
                    )}
                    {candidate.match_score !== undefined && (
                      <MetaRow icon={Sparkles} label="Match score">
                        <span className="font-medium">{Math.round(candidate.match_score)}%</span>
                      </MetaRow>
                    )}
                    {candidate.total_experience_years !== undefined && (
                      <MetaRow icon={Briefcase} label="Experience">
                        {candidate.total_experience_years} years
                      </MetaRow>
                    )}
                  </div>
                </Section>

                {hasAiSnapshot && (
                  <Section
                    icon={Sparkles}
                    title="AI Insights"
                    description="Existing analysis for this candidate"
                    action={
                      <Button variant="ghost" size="xs" onClick={() => setActiveTab("insights")}>
                        View all
                      </Button>
                    }
                  >
                    <div className="space-y-2.5">
                      {candidate.match_score !== undefined && (
                        <div>
                          <div className="mb-1 flex items-center justify-between text-[11.5px]">
                            <span className="text-muted">Match score</span>
                            <span className="font-medium text-ink">{Math.round(candidate.match_score)}%</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-track">
                            <div
                              className="h-full rounded-full bg-info"
                              style={{ width: `${Math.round(candidate.match_score)}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {candidate.flight_risk && (
                        <div className="flex items-center justify-between text-[12px]">
                          <span className="text-muted">Flight risk</span>
                          <Badge variant={getFlightRiskVariant(candidate.flight_risk)}>
                            {candidate.flight_risk}
                          </Badge>
                        </div>
                      )}
                      {candidate.growth_trajectory && (
                        <div className="flex items-start justify-between gap-3 text-[12px]">
                          <span className="shrink-0 text-muted">Growth</span>
                          <span className="text-right text-ink">{candidate.growth_trajectory}</span>
                        </div>
                      )}
                    </div>
                  </Section>
                )}
              </div>
            </div>
          </TabsPanel>

          {/* Timeline Tab */}
          <TabsPanel value="timeline" className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-md bg-surface-secondary text-muted">
                  <Clock3 className="size-3.5" strokeWidth={1.75} />
                </span>
                <div>
                  <h3 className="text-[13px] font-medium leading-tight text-ink">Activity Timeline</h3>
                  <p className="mt-0.5 text-[11px] leading-tight text-faint">Status changes and hiring events</p>
                </div>
              </div>
              {activeTab === "timeline" && (
                <CandidateTimeline candidateId={candidate.id} />
              )}
            </div>
          </TabsPanel>

          {/* Insights Tab */}
          <TabsPanel value="insights" className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            <Section icon={Sparkles} title="AI Snapshot" description="Existing analysis for this candidate">
              {!hasAiSnapshot ? (
                <p className="text-[12.5px] text-muted">No AI analysis on file for this candidate yet.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {candidate.match_score !== undefined && (
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-[10px] uppercase tracking-[0.05em] text-faint">Match score</p>
                      <p className="mt-1 text-[18px] font-semibold text-ink">{Math.round(candidate.match_score)}%</p>
                    </div>
                  )}
                  {candidate.flight_risk && (
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-[10px] uppercase tracking-[0.05em] text-faint">Flight risk</p>
                      <div className="mt-1.5">
                        <Badge variant={getFlightRiskVariant(candidate.flight_risk)}>
                          {candidate.flight_risk}
                        </Badge>
                      </div>
                    </div>
                  )}
                  {candidate.growth_trajectory && (
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-[10px] uppercase tracking-[0.05em] text-faint">Growth trajectory</p>
                      <p className="mt-1 text-[12.5px] leading-snug text-ink">{candidate.growth_trajectory}</p>
                    </div>
                  )}
                </div>
              )}
            </Section>

            <Section
              icon={MessageSquare}
              title="Screening Questions"
              description="AI-generated questions to verify claimed skills"
              action={
                screeningQuestions ? (
                  <Button variant="ghost" size="xs" onClick={() => setActiveTab("screening")}>
                    View
                  </Button>
                ) : (
                  <Button size="xs" onClick={generateQuestions} disabled={loadingQuestions}>
                    <Sparkles className="size-3.5" strokeWidth={1.75} />
                    {loadingQuestions ? "Generating..." : "Generate"}
                  </Button>
                )
              }
            >
              {screeningQuestions ? (
                <p className="flex items-center gap-1.5 text-[12.5px] text-success">
                  <CircleCheck className="size-3.5" strokeWidth={1.75} />
                  {screeningQuestions.length} questions ready
                </p>
              ) : (
                <p className="text-[12.5px] text-muted">
                  Generate personalized verification questions from the Screening Questions tab.
                </p>
              )}
            </Section>

            <Section
              icon={Target}
              title="Closing Strategy"
              description="Negotiation intel to help close the offer"
              action={
                closingStrategy ? (
                  <Button variant="ghost" size="xs" onClick={() => setActiveTab("closing")}>
                    View
                  </Button>
                ) : (
                  <Button size="xs" onClick={generateStrategy} disabled={loadingStrategy}>
                    <Sparkles className="size-3.5" strokeWidth={1.75} />
                    {loadingStrategy ? "Generating..." : "Get Strategy"}
                  </Button>
                )
              }
            >
              {closingStrategy ? (
                <p className="flex items-center gap-1.5 text-[12.5px] text-success">
                  <CircleCheck className="size-3.5" strokeWidth={1.75} />
                  Strategy ready
                </p>
              ) : (
                <p className="text-[12.5px] text-muted">
                  Generate selling points and objection handling from the Closing Strategy tab.
                </p>
              )}
            </Section>
          </TabsPanel>

          {/* Notes Tab */}
          <TabsPanel value="notes" className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            <div>
              <h3 className="text-[13px] font-medium text-ink">Candidate Notes</h3>
              <p className="mt-0.5 text-[11.5px] text-muted">
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
              size="sm"
            >
              {savingNote && <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />}
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
              <div className="py-8 text-center">
                <FileText className="mx-auto mb-3 size-8 text-muted-foreground/40" strokeWidth={1.5} />
                <p className="text-[12.5px] text-muted">No notes yet. Add one above.</p>
              </div>
            )}

            {notes.length > 0 && (
              <div className="space-y-2">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-lg border-l-4 border-primary/30 bg-muted/30 p-3 text-[13px]"
                  >
                    <p>{note.note_text}</p>
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      {formatDate(note.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </TabsPanel>

          {/* Screening Questions Tab */}
          <TabsPanel value="screening" className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-[13px] font-medium text-ink">Screening Questions</h3>
                <p className="mt-0.5 text-[11.5px] text-muted">
                  AI-generated questions to verify claimed skills
                </p>
              </div>
              <Button size="sm" onClick={generateQuestions} disabled={loadingQuestions}>
                <Sparkles className="size-3.5" strokeWidth={1.75} />
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
                    className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3"
                  >
                    <span className="mt-0.5 shrink-0 font-mono text-[11px] text-muted-foreground">
                      #{i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px]">{q.question}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{q.focus_area}</Badge>
                        <span className="text-[10px] text-muted-foreground">{q.why_this_matters}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!screeningQuestions && !loadingQuestions && !questionsError && (
              <div className="py-12 text-center">
                <MessageSquare className="mx-auto mb-3 size-10 text-muted-foreground/30" strokeWidth={1.5} />
                <p className="text-[12.5px] text-muted">
                  Click Generate to create AI-powered screening questions.
                </p>
              </div>
            )}
          </TabsPanel>

          {/* Closing Strategy Tab */}
          <TabsPanel value="closing" className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-[13px] font-medium text-ink">Closing Strategy</h3>
                <p className="mt-0.5 text-[11.5px] text-muted">
                  Negotiation intel to help close the offer
                </p>
              </div>
              <Button size="sm" onClick={generateStrategy} disabled={loadingStrategy}>
                <Sparkles className="size-3.5" strokeWidth={1.75} />
                {loadingStrategy ? "Generating..." : "Get Strategy"}
              </Button>
            </div>

            {loadingStrategy && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-green-50/50 p-4 dark:bg-green-950/10">
                  <h4 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-green-600">
                    <ThumbsUp className="size-3.5" strokeWidth={1.75} />
                    Selling Points
                  </h4>
                  <ul className="space-y-2">
                    {closingStrategy.selling_points.map((sp, i) => (
                      <li key={i} className="flex items-start gap-2 text-[13px]">
                        <CircleCheck className="mt-0.5 size-4 shrink-0 text-green-500" strokeWidth={1.75} />
                        <div>
                          <p className="font-medium text-green-800">{sp.point}</p>
                          <p className="text-[11.5px] text-green-600">{sp.detail}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-border bg-amber-50/50 p-4 dark:bg-amber-950/10">
                  <h4 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-600">
                    <AlertTriangle className="size-3.5" strokeWidth={1.75} />
                    Objection to Overcome
                  </h4>
                  <p className="mt-1 flex items-start gap-2 text-[13px]">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" strokeWidth={1.75} />
                    <span className="font-medium text-amber-800">{closingStrategy.major_objection.objection}</span>
                  </p>
                  <p className="ml-6 mt-2 flex items-start gap-1.5 text-[11.5px] text-amber-600">
                    <ArrowRight className="mt-0.5 size-3 shrink-0" strokeWidth={1.75} />
                    {closingStrategy.major_objection.overcome_strategy}
                  </p>
                </div>
              </div>
            )}

            {!closingStrategy && !loadingStrategy && !strategyError && (
              <div className="py-12 text-center">
                <Target className="mx-auto mb-3 size-10 text-muted-foreground/30" strokeWidth={1.5} />
                <p className="text-[12.5px] text-muted">
                  Click Get Strategy to generate selling points and objection handling.
                </p>
              </div>
            )}
          </TabsPanel>
        </Tabs>
      </DialogContent>

      <ScheduleInterviewModal
        open={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        candidateId={candidate.id}
        onSuccess={() => {
          setLocalStatus("Interview Scheduled")
          onStatusChange?.()
        }}
      />

      <RejectModal
        open={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        candidateId={candidate.id}
        onSuccess={() => {
          setLocalStatus("Rejected")
          onStatusChange?.()
        }}
      />

      <MakeOfferModal
        open={showOfferModal}
        onClose={() => setShowOfferModal(false)}
        candidateId={candidate.id}
        onSuccess={() => {
          setLocalStatus("Offered")
          onStatusChange?.()
        }}
      />

      {showEmailModal && (
        <GmailOutreachModal
          open={showEmailModal}
          onClose={() => setShowEmailModal(false)}
          candidateId={candidate.id}
          candidateName={candidate.full_name || "Candidate"}
          candidateEmail={candidate.email || ""}
        />
      )}
    </Dialog>
  )
}
