"use client"

import { useState, useCallback, useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Sparkles,
  LayoutGrid,
  Tags,
  FolderGit2,
  Clock3,
  StickyNote,
  Activity,
  FileText,
  Database,
  Search,
  Calendar,
  CircleCheck,
  CircleX,
  Copy,
  Check,
  ExternalLink,
  Download,
  BriefcaseBusiness,
  Globe,
  Code2,
  CircleAlert,
  ThumbsUp,
  ArrowRight,
} from "lucide-react"
import useSWR, { useSWRConfig } from "swr"
import { useApi } from "@/hooks/use-api"
import { ROUTES, getInitials } from "@/lib/constants"
import { formatDate } from "@/lib/helpers"
import { StatusDot } from "@/components/ui/status-dot"
import { Button } from "@/components/ui/button"
import type { CandidateBrief, ApiResponse } from "@/lib/types"
import { GmailOutreachModal } from "@/components/gmail-outreach-modal"
import { GmailLogo } from "@/components/gmail-logo"
import {
  MatchScoreCard,
  ExecutiveSummaryCard,
  SkillCoverageCard,
  ExperienceAnalysisCard,
  EducationAnalysisCard,
  RiskAssessmentCard,
  ResumePreviewCard,
  RecruiterNotesCard,
  SimilarCandidatesBar,
} from "@/components/candidate-brief"
import { CandidateTimeline } from "@/components/candidate-timeline"
import { ScheduleInterviewModal } from "@/components/schedule-interview-modal"
import { RejectModal } from "@/components/reject-modal"
import { MakeOfferModal } from "@/components/make-offer-modal"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "ai-brief", label: "AI Brief", icon: Sparkles },
  { id: "skills", label: "Skills", icon: Tags },
  { id: "experience", label: "Experience", icon: Briefcase },
  { id: "projects", label: "Projects", icon: FolderGit2 },
  { id: "timeline", label: "Timeline", icon: Clock3 },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "resume", label: "Resume", icon: FileText },
  { id: "parsed", label: "Parsed Data", icon: Database },
]

function statusClasses(status?: string): string {
  const s = (status || "").toLowerCase()
  if (s === "hired" || s === "offered" || s === "pending offer")
    return "border-green-500/25 bg-green-500/10 text-green-700 dark:text-green-400"
  if (s === "rejected") return "border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400"
  if (s.includes("interview") || s === "technical round" || s === "hr round")
    return "border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-400"
  if (s === "applied" || s === "screening" || s === "shortlisted")
    return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400"
  return "border-border bg-surface-secondary text-muted"
}

function cleanUrlLabel(url: string): string {
  try {
    const withProto = url.startsWith("http") ? url : `https://${url}`
    const u = new URL(withProto)
    const path = u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "")
    return `${u.hostname.replace(/^www\./, "")}${path}`.slice(0, 44)
  } catch {
    return url.slice(0, 44)
  }
}

function ensureHref(url: string): string {
  return url.startsWith("http") ? url : `https://${url}`
}

function extractSocialLinks(texts: Array<string | undefined | null>): {
  linkedin?: string
  github?: string
  leetcode?: string
  portfolio?: string
} {
  const combined = texts.filter(Boolean).join("\n") as string
  if (!combined) return {}
  const found: string[] = []
  const urlRe = /(https?:\/\/[^\s,;)]+|(?:www\.)?[a-z0-9-]+\.(?:com|dev|io|me|co|in|net|org)[^\s,;)]*)/gi
  const matches = combined.match(urlRe) || []
  for (const m of matches) {
    const cleaned = m.replace(/[.,;)]+$/, "")
    if (cleaned.length > 4 && !found.includes(cleaned)) found.push(cleaned)
  }
  const links: { linkedin?: string; github?: string; leetcode?: string; portfolio?: string } = {}
  for (const u of found) {
    const l = u.toLowerCase()
    if (!links.linkedin && l.includes("linkedin.com")) links.linkedin = u
    else if (!links.github && l.includes("github.com")) links.github = u
    else if (!links.leetcode && l.includes("leetcode.com")) links.leetcode = u
  }
  const other = found.find(
    (u) =>
      !u.toLowerCase().includes("linkedin.com") &&
      !u.toLowerCase().includes("github.com") &&
      !u.toLowerCase().includes("leetcode.com") &&
      !u.toLowerCase().includes("gmail.com") &&
      !u.toLowerCase().includes("google.com"),
  )
  if (other) links.portfolio = other
  return links
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String).filter(Boolean) : []
}

function asRecordArray(v: unknown): Array<Record<string, unknown>> {
  return Array.isArray(v) ? (v as Array<Record<string, unknown>>) : []
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Mail
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-secondary text-muted">
          <Icon className="size-3.5" strokeWidth={1.75} />
        </span>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted">{title}</h3>
      </div>
      {children}
    </section>
  )
}

function BriefSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-6 md:py-8">
      <div className="mb-6 h-4 w-32 animate-pulse rounded bg-muted" />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border border-border bg-surface p-5">
              <div className="mb-3 h-3 w-24 rounded bg-muted" />
              <div className="space-y-2">
                <div className="h-3 w-full rounded bg-muted" />
                <div className="h-3 w-3/4 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-5">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border border-border bg-surface p-5">
              <div className="mb-3 h-3 w-24 rounded bg-muted" />
              <div className="h-3 w-2/3 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function CandidateDetailPage() {
  const params = useParams()
  const candidateId = params.id as string
  const api = useApi()
  const { mutate } = useSWRConfig()

  const briefKey = useMemo(() => ["candidate-brief", candidateId], [candidateId])
  const { data: briefRes, error: briefError, isLoading } = useSWR<ApiResponse<CandidateBrief>>(
    briefKey,
    () => api.getCandidateBrief(candidateId),
    { revalidateOnFocus: false, revalidateOnReconnect: false, keepPreviousData: true },
  )

  const brief = briefRes?.data ?? null
  const briefErr = briefError ? "Failed to connect to server" : (!isLoading && !briefRes?.success ? (briefRes?.error || "Candidate not found") : "")

  const [activeTab, setActiveTab] = useState("overview")
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showOfferModal, setShowOfferModal] = useState(false)
  const [screening, setScreening] = useState(false)
  const [copied, setCopied] = useState(false)
  const [localStatus, setLocalStatus] = useState<string | undefined>(undefined)

  const handleAddNote = useCallback(async (text: string) => {
    await api.addCandidateNote(candidateId, text)
    mutate(briefKey)
  }, [candidateId, api, mutate, briefKey])

  if (isLoading) return <BriefSkeleton />

  if (briefErr || !brief) {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:px-6 md:py-8">
        <Link href={ROUTES.candidateSearch}>
          <span className="mb-4 inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.75} /> Back to Search
          </span>
        </Link>
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <p className="text-sm text-muted-foreground">{briefErr || "Candidate not found"}</p>
        </div>
      </div>
    )
  }

  const { candidate, record, parsedResume, notes, similarCandidates, scores } = brief
  const strengths = asStringArray((parsedResume as Record<string, unknown> | null)?.strengths)
  const weaknesses = asStringArray((parsedResume as Record<string, unknown> | null)?.weaknesses)
  const missingSkills = asStringArray((parsedResume as Record<string, unknown> | null)?.missing_skills)
  const workHistory = asRecordArray((parsedResume as Record<string, unknown> | null)?.work_history)
  const projects = asRecordArray((parsedResume as Record<string, unknown> | null)?.projects)

  const status = localStatus ?? record.currentStatus ?? "Applied"
  const isTerminal = status === "Rejected"
  const isHired = status === "Hired"
  const totalYears = record.totalExperienceYears ?? candidate.experience
  const social = extractSocialLinks([record.rawResumeText, candidate.summary])
  const hasLinks = !!(social.linkedin || social.github || social.portfolio || social.leetcode)
  const hasContact = !!(record.email || record.phone || record.location)
  const hasRisk = !!(record.flightRisk || record.growthTrajectory)
  const hasAiData = !!(candidate.summary || strengths.length > 0 || weaknesses.length > 0 || scores)

  const nextStep =
    status === "Applied" ? "Move to Screening to review fit"
    : status === "Screening" ? "Schedule an interview to verify skills"
    : status === "Interview Scheduled" ? "Complete the interview and record feedback"
    : status === "Offered" ? "Close the offer and confirm joining"
    : status === "Hired" ? "Candidate hired — no further action"
    : status === "Rejected" ? "Candidate rejected — no further action"
    : "Review and advance to the next stage"

  async function handleScreening() {
    setScreening(true)
    try {
      const res = await api.updateCandidateStatus(candidateId, "Screening")
      if (res.success) {
        setLocalStatus("Screening")
        toast.success("Candidate moved to Screening")
        mutate(briefKey)
      } else {
        toast.error(res.error || "Failed to update status")
      }
    } catch {
      toast.error("Failed to update status")
    } finally {
      setScreening(false)
    }
  }

  async function handleCopyEmail() {
    if (!record.email) return
    try {
      await navigator.clipboard.writeText(record.email)
      setCopied(true)
      toast.success("Email copied")
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Failed to copy email")
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-6 md:py-8">
      <Link href={ROUTES.candidateSearch}>
        <span className="mb-4 inline-flex items-center text-[12.5px] font-medium text-muted transition-colors hover:text-ink">
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.75} /> Back to Search
        </span>
      </Link>

      {/* Header */}
      <div className="mb-5 rounded-xl border border-border bg-surface p-4 sm:p-5 md:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-soft ring-1 ring-border">
              <span className="text-lg font-semibold text-muted">
                {getInitials(candidate.name)}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                <h1 className="truncate text-[18px] font-semibold tracking-tight text-ink">{candidate.name}</h1>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                    statusClasses(status),
                  )}
                >
                  <StatusDot status={status} />
                  {status}
                </span>
              </div>
              {(record.currentTitle || record.currentCompany) && (
                <p className="mt-1 flex items-center gap-1.5 truncate text-[13px] text-muted">
                  <Briefcase className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                  <span className="truncate">
                    {record.currentTitle}
                    {record.currentTitle && record.currentCompany ? " · " : ""}
                    {record.currentCompany}
                  </span>
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {record.email && (
                  <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-surface-secondary px-2 py-1 text-[12px] text-muted">
                    <Mail className="h-3 w-3 shrink-0" strokeWidth={1.75} />
                    <span className="truncate">{record.email}</span>
                  </span>
                )}
                {record.phone && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-secondary px-2 py-1 text-[12px] text-muted">
                    <Phone className="h-3 w-3 shrink-0" strokeWidth={1.75} />
                    {record.phone}
                  </span>
                )}
                {record.location && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-secondary px-2 py-1 text-[12px] text-muted">
                    <MapPin className="h-3 w-3 shrink-0" strokeWidth={1.75} />
                    {record.location}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-3.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleScreening}
              disabled={screening || isTerminal || status === "Screening"}
              className="border-amber-500/25 text-[12.5px] text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
            >
              <Search className="size-3.5" strokeWidth={1.75} />
              {screening ? "Updating..." : "Screening"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowScheduleModal(true)}
              disabled={isTerminal}
              className="border-blue-500/25 text-[12.5px] text-blue-700 hover:bg-blue-500/10 dark:text-blue-400"
            >
              <Calendar className="size-3.5" strokeWidth={1.75} />
              Schedule Interview
            </Button>
            <Button
              size="sm"
              onClick={() => setShowOfferModal(true)}
              disabled={isTerminal || isHired}
              className="bg-green-600 text-[12.5px] text-white hover:bg-green-700"
            >
              <CircleCheck className="size-3.5" strokeWidth={1.75} />
              Hire
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRejectModal(true)}
              disabled={isTerminal}
              className="border-red-500/25 text-[12.5px] text-red-600 hover:bg-red-500/10 dark:text-red-400"
            >
              <CircleX className="size-3.5" strokeWidth={1.75} />
              Reject
            </Button>
            <Button
              size="sm"
              onClick={() => setShowEmailModal(true)}
              disabled={!record.email}
              title={record.email ? `Send outreach to ${candidate.name}` : "No email on file for this candidate"}
              className="sm:ml-auto"
            >
              <GmailLogo className="size-4" />
              Send Email
            </Button>
          </div>
          {!record.email && (
            <p className="text-[11.5px] text-faint">No email on file — email outreach unavailable.</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-border pb-px [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-[12.5px] font-medium transition-colors",
              activeTab === tab.id
                ? "border-brand text-brand"
                : "border-transparent text-muted hover:text-ink",
            )}
          >
            <tab.icon className="size-3.5" strokeWidth={1.75} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="grid items-start gap-4 lg:grid-cols-3 lg:gap-5">
          {/* Main */}
          <div className="min-w-0 space-y-4 lg:col-span-2 lg:space-y-5">
            {candidate.summary && (
              <ExecutiveSummaryCard summary={candidate.summary} />
            )}
            {candidate.skills.length > 0 && (
              <SkillCoverageCard
                skills={candidate.skills}
                strengths={strengths}
                missingSkills={missingSkills}
              />
            )}
            {(workHistory.length > 0 || totalYears !== undefined) && (
              <Section icon={Briefcase} title="Experience">
                {totalYears !== undefined && (
                  <div className="mb-3 flex items-baseline gap-1.5">
                    <span className="text-[28px] font-bold leading-none text-ink">{totalYears}</span>
                    <span className="text-[13px] text-muted">years total</span>
                  </div>
                )}
                {(record.currentTitle || record.currentCompany) && (
                  <p className="mb-3 text-[13px] text-muted">
                    {record.currentTitle && <span className="font-medium text-ink">{record.currentTitle}</span>}
                    {record.currentTitle && record.currentCompany && <span> at </span>}
                    {record.currentCompany && <span>{record.currentCompany}</span>}
                  </p>
                )}
                {workHistory.length > 0 ? (
                  <div className="space-y-0">
                    {workHistory.map((wh, i) => (
                      <div key={i} className="relative flex gap-3 pb-4 last:pb-0">
                        {i < workHistory.length - 1 && (
                          <span className="absolute bottom-0 left-[13px] top-7 w-px bg-border" aria-hidden />
                        )}
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-secondary/60">
                          <Briefcase className="size-3.5 text-muted" strokeWidth={1.75} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-ink">
                            {String(wh.title || wh.role || wh.position || "Role")}
                          </p>
                          {!!(wh.company || wh.employer) && (
                            <p className="text-[12px] text-muted">{String(wh.company ?? wh.employer ?? "")}</p>
                          )}
                          {!!(wh.duration || wh.duration_years || wh.start_date || wh.end_date) && (
                            <p className="mt-0.5 text-[11.5px] text-faint">
                              {[wh.duration || (wh.duration_years ? `${String(wh.duration_years)} yrs` : ""), wh.start_date, wh.end_date].filter(Boolean).map((x) => String(x)).join(" · ")}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] text-muted">No detailed work history on file.</p>
                )}
              </Section>
            )}
            {projects.length > 0 && (
              <Section icon={FolderGit2} title={`Projects · ${projects.length}`}>
                <div className="grid gap-3 sm:grid-cols-2">
                  {projects.map((proj, i) => (
                    <div key={i} className="rounded-lg border border-border p-3.5">
                      <p className="text-[13px] font-medium text-ink">
                        {String(proj.name || proj.title || `Project ${i + 1}`)}
                      </p>
                      {proj.description ? (
                        <p className="mt-1 line-clamp-3 text-[12px] leading-relaxed text-muted">{String(proj.description)}</p>
                      ) : null}
                      {Array.isArray(proj.technologies) && (proj.technologies as unknown[]).length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {(proj.technologies as unknown[]).map((t) => (
                            <span key={String(t)} className="rounded bg-surface-secondary px-1.5 py-0.5 text-[11px] text-muted">{String(t)}</span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </Section>
            )}
            {similarCandidates.length > 0 && (
              <SimilarCandidatesBar candidates={similarCandidates} />
            )}
          </div>

          {/* Sidebar */}
          <div className="min-w-0 space-y-4 lg:space-y-5">
            <MatchScoreCard scores={scores} />
            {totalYears !== undefined && (
              <ExperienceAnalysisCard
                totalYears={totalYears}
                currentTitle={record.currentTitle}
                currentCompany={record.currentCompany}
                weaknesses={weaknesses.length > 0 ? weaknesses : undefined}
              />
            )}
            {(candidate.education?.level || candidate.education?.field) && (
              <EducationAnalysisCard
                level={candidate.education.level}
                field={candidate.education.field}
                details={candidate.education.details}
              />
            )}
            {hasRisk && (
              <RiskAssessmentCard
                flightRisk={record.flightRisk}
                growthTrajectory={record.growthTrajectory}
              />
            )}
            {hasContact && (
              <Section icon={Mail} title="Contact">
                <div className="space-y-1.5">
                  {record.email && (
                    <div className="flex items-center gap-2.5 rounded-lg border border-border p-2.5">
                      <Mail className="size-3.5 shrink-0 text-faint" strokeWidth={1.75} />
                      <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{record.email}</span>
                      <button
                        onClick={handleCopyEmail}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-secondary hover:text-ink"
                        aria-label="Copy email"
                      >
                        {copied ? <Check className="size-3.5 text-success" strokeWidth={1.75} /> : <Copy className="size-3.5" strokeWidth={1.75} />}
                      </button>
                    </div>
                  )}
                  {record.phone && (
                    <div className="flex items-center gap-2.5 rounded-lg border border-border p-2.5">
                      <Phone className="size-3.5 shrink-0 text-faint" strokeWidth={1.75} />
                      <span className="truncate text-[12.5px] text-ink">{record.phone}</span>
                    </div>
                  )}
                  {record.location && (
                    <div className="flex items-center gap-2.5 rounded-lg border border-border p-2.5">
                      <MapPin className="size-3.5 shrink-0 text-faint" strokeWidth={1.75} />
                      <span className="truncate text-[12.5px] text-ink">{record.location}</span>
                    </div>
                  )}
                  {record.email && (
                    <Button size="sm" variant="outline" className="mt-1 w-full" onClick={() => setShowEmailModal(true)}>
                      <GmailLogo className="size-3.5" />
                      Send email
                    </Button>
                  )}
                </div>
              </Section>
            )}
            {hasLinks && (
              <Section icon={Globe} title="Links">
                <div className="space-y-1.5">
                  {social.linkedin && (
                    <a href={ensureHref(social.linkedin)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 rounded-lg border border-border p-2.5 transition-colors hover:border-border-hover hover:bg-surface-secondary/50">
                      <BriefcaseBusiness className="size-3.5 shrink-0 text-[#0A66C2]" strokeWidth={1.75} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12px] font-medium text-ink">LinkedIn</span>
                        <span className="block truncate text-[11px] text-faint">{cleanUrlLabel(social.linkedin)}</span>
                      </span>
                    </a>
                  )}
                  {social.github && (
                    <a href={ensureHref(social.github)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 rounded-lg border border-border p-2.5 transition-colors hover:border-border-hover hover:bg-surface-secondary/50">
                      <FolderGit2 className="size-3.5 shrink-0 text-ink" strokeWidth={1.75} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12px] font-medium text-ink">GitHub</span>
                        <span className="block truncate text-[11px] text-faint">{cleanUrlLabel(social.github)}</span>
                      </span>
                    </a>
                  )}
                  {social.portfolio && (
                    <a href={ensureHref(social.portfolio)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 rounded-lg border border-border p-2.5 transition-colors hover:border-border-hover hover:bg-surface-secondary/50">
                      <Globe className="size-3.5 shrink-0 text-info" strokeWidth={1.75} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12px] font-medium text-ink">Portfolio</span>
                        <span className="block truncate text-[11px] text-faint">{cleanUrlLabel(social.portfolio)}</span>
                      </span>
                    </a>
                  )}
                  {social.leetcode && (
                    <a href={ensureHref(social.leetcode)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 rounded-lg border border-border p-2.5 transition-colors hover:border-border-hover hover:bg-surface-secondary/50">
                      <Code2 className="size-3.5 shrink-0 text-warning" strokeWidth={1.75} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12px] font-medium text-ink">LeetCode</span>
                        <span className="block truncate text-[11px] text-faint">{cleanUrlLabel(social.leetcode)}</span>
                      </span>
                    </a>
                  )}
                </div>
              </Section>
            )}
          </div>
        </div>
      )}

      {activeTab === "ai-brief" && (
        <div className="space-y-4">
          {!hasAiData ? (
            <div className="rounded-xl border border-border bg-surface p-10 text-center">
              <Sparkles className="mx-auto mb-3 size-8 text-faint" strokeWidth={1.5} />
              <p className="text-[13.5px] font-medium text-ink">AI analysis isn&apos;t available yet.</p>
              <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-muted">
                Run an AI search with a job description to generate match insights for this candidate.
              </p>
            </div>
          ) : (
            <div className="grid items-start gap-4 lg:grid-cols-3 lg:gap-5">
              <div className="min-w-0 space-y-4 lg:col-span-2">
                {candidate.summary && (
                  <Section icon={Sparkles} title="Why this candidate matches">
                    <p className="text-[13.5px] leading-relaxed text-ink/90">{candidate.summary}</p>
                    {scores && (
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {[
                          { label: "Skill", v: scores.skill },
                          { label: "Experience", v: scores.experience },
                          { label: "Education", v: scores.education },
                        ].map((s) => (
                          <div key={s.label} className="rounded-lg border border-border p-2.5 text-center">
                            <p className="text-[10px] uppercase tracking-[0.05em] text-faint">{s.label}</p>
                            <p className="mt-0.5 font-data text-[15px] font-semibold text-ink">{Math.round(s.v * 100)}%</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </Section>
                )}
                {strengths.length > 0 && (
                  <Section icon={ThumbsUp} title="Strengths">
                    <ul className="space-y-1.5">
                      {strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-[13px] text-muted">
                          <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-success" strokeWidth={1.75} />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}
                {weaknesses.length > 0 && (
                  <Section icon={CircleAlert} title="Potential concerns">
                    <ul className="space-y-1.5">
                      {weaknesses.map((w, i) => (
                        <li key={i} className="flex items-start gap-2 text-[13px] text-muted">
                          <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" strokeWidth={1.75} />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}
                {candidate.skills.length > 0 && (
                  <SkillCoverageCard skills={candidate.skills} strengths={strengths} missingSkills={missingSkills} />
                )}
              </div>
              <div className="min-w-0 space-y-4">
                <MatchScoreCard scores={scores} />
                <Section icon={ArrowRight} title="Recommended next step">
                  <p className="text-[13px] leading-relaxed text-ink">{nextStep}</p>
                  <p className="mt-1 text-[11.5px] text-faint">Based on current stage: {status}</p>
                </Section>
                {hasRisk && (
                  <RiskAssessmentCard flightRisk={record.flightRisk} growthTrajectory={record.growthTrajectory} />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "skills" && (
        <div className="grid items-start gap-4 md:grid-cols-2 lg:gap-5">
          <SkillCoverageCard skills={candidate.skills} strengths={strengths} missingSkills={missingSkills} />
          <Section icon={Tags} title={`All skills · ${candidate.skills.length}`}>
            {candidate.skills.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {candidate.skills.map((skill) => (
                  <span key={skill} className="rounded-lg border border-brand/15 bg-brand/5 px-2.5 py-1.5 text-[12px] text-brand">
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-muted">No skills listed.</p>
            )}
          </Section>
        </div>
      )}

      {activeTab === "experience" && (
        <div className="grid items-start gap-4 md:grid-cols-2 lg:gap-5">
          {totalYears !== undefined ? (
            <ExperienceAnalysisCard
              totalYears={totalYears}
              currentTitle={record.currentTitle}
              currentCompany={record.currentCompany}
              weaknesses={weaknesses.length > 0 ? weaknesses : undefined}
            />
          ) : (
            <div className="rounded-xl border border-border bg-surface p-5">
              <p className="text-[13px] text-muted">No experience data available.</p>
            </div>
          )}
          <Section icon={Briefcase} title="Work history">
            {workHistory.length > 0 ? (
              <div>
                {workHistory.map((wh, i) => (
                  <div key={i} className="relative flex gap-3 pb-4 last:pb-0">
                    {i < workHistory.length - 1 && (
                      <span className="absolute bottom-0 left-[13px] top-7 w-px bg-border" aria-hidden />
                    )}
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-secondary/60">
                      <Briefcase className="size-3.5 text-muted" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-ink">{String(wh.company ?? wh.employer ?? "Company")}</p>
                      <p className="text-[12px] text-muted">{String(wh.title ?? wh.role ?? wh.position ?? "")}</p>
                      <p className="mt-0.5 text-[11.5px] text-faint">
                        {[wh.duration || (wh.duration_years ? `${String(wh.duration_years)} yrs` : ""), wh.start_date, wh.end_date].filter(Boolean).map((x) => String(x)).join(" · ")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-muted">No work history data available.</p>
            )}
          </Section>
        </div>
      )}

      {activeTab === "projects" && (
        <Section icon={FolderGit2} title={projects.length > 0 ? `Projects · ${projects.length}` : "Projects"}>
          {projects.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {projects.map((proj, i) => (
                <div key={i} className="rounded-lg border border-border p-4">
                  <p className="text-[13.5px] font-medium text-ink">{String(proj.name || proj.title || `Project ${i + 1}`)}</p>
                  {proj.description ? (
                    <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{String(proj.description)}</p>
                  ) : null}
                  {Array.isArray(proj.technologies) && (proj.technologies as unknown[]).length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(proj.technologies as unknown[]).map((t: unknown) => (
                        <span key={String(t)} className="rounded bg-surface-secondary px-1.5 py-0.5 text-[11px] text-muted">{String(t)}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-muted">No project data available.</p>
          )}
        </Section>
      )}

      {activeTab === "timeline" && (
        <Section icon={Clock3} title="Status timeline">
          <CandidateTimeline candidateId={candidateId} />
        </Section>
      )}

      {activeTab === "notes" && (
        <RecruiterNotesCard notes={notes} onAddNote={handleAddNote} />
      )}

      {activeTab === "activity" && (
        <Section icon={Activity} title="Activity">
          {brief.timeline.length > 0 ? (
            <div className="space-y-2">
              {brief.timeline.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 border-b border-border pb-2.5 last:border-0 last:pb-0">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-secondary">
                    <Sparkles className="h-3 w-3 text-muted" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-ink">
                      Status changed to <span className="font-medium">{entry.status}</span>
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-faint">
                      {new Date(entry.changed_at).toLocaleDateString(undefined, {
                        month: "short", day: "numeric", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                      {entry.changed_by ? ` by ${entry.changed_by}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-muted">No activity recorded yet.</p>
          )}
        </Section>
      )}

      {activeTab === "resume" && (
        <div className="space-y-4">
          {(record.resumeFileUrl || record.createdAt) && (
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-secondary text-muted">
                  <FileText className="size-5" strokeWidth={1.5} />
                </span>
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium text-ink">Resume</p>
                  {record.createdAt && (
                    <p className="text-[12px] text-muted">Uploaded {formatDate(record.createdAt)}</p>
                  )}
                </div>
              </div>
              {record.resumeFileUrl && (
                <div className="flex shrink-0 gap-2">
                  <a
                    href={record.resumeFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3.5 text-[12.5px] font-medium text-ink transition-colors hover:bg-surface-secondary"
                  >
                    <ExternalLink className="size-3.5" strokeWidth={1.75} />
                    View Resume
                  </a>
                  <a
                    href={record.resumeFileUrl}
                    download
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3.5 text-[12.5px] font-medium text-ink transition-colors hover:bg-surface-secondary"
                  >
                    <Download className="size-3.5" strokeWidth={1.75} />
                    Download
                  </a>
                </div>
              )}
            </div>
          )}
          <ResumePreviewCard
            rawResumeText={record.rawResumeText}
            resumeFileUrl={record.resumeFileUrl}
          />
        </div>
      )}

      {activeTab === "parsed" && (
        <Section icon={Database} title="Parsed resume data">
          {parsedResume ? (
            <pre className="max-h-96 overflow-auto rounded-lg bg-surface-secondary/60 p-4 font-data text-[11.5px] leading-relaxed text-muted">
              {JSON.stringify(parsedResume, null, 2)}
            </pre>
          ) : (
            <p className="text-[13px] text-muted">No parsed resume data available.</p>
          )}
        </Section>
      )}

      {showEmailModal && (
        <GmailOutreachModal
          open={showEmailModal}
          onClose={() => setShowEmailModal(false)}
          candidateId={candidateId}
          candidateName={candidate.name}
          candidateEmail={record.email || ""}
        />
      )}
      <ScheduleInterviewModal
        open={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        candidateId={candidateId}
        onSuccess={() => {
          setLocalStatus("Interview Scheduled")
          mutate(briefKey)
        }}
      />
      <RejectModal
        open={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        candidateId={candidateId}
        onSuccess={() => {
          setLocalStatus("Rejected")
          mutate(briefKey)
        }}
      />
      <MakeOfferModal
        open={showOfferModal}
        onClose={() => setShowOfferModal(false)}
        candidateId={candidateId}
        onSuccess={() => {
          setLocalStatus("Offered")
          mutate(briefKey)
        }}
      />
    </div>
  )
}
