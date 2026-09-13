"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  X,
  Mail,
  Phone,
  MapPin,
  GraduationCap,
  Briefcase,
  Sparkles,
  Search,
  CircleCheck,
  CircleX,
  ArrowRight,
  Copy,
  Check,
  BriefcaseBusiness,
  FolderGit2,
  Globe,
  Code2,
  Building2,
  User,
  Calendar,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScoreRing } from "@/components/ui/score-ring"
import { ProgressBar } from "@/components/ui/progress-bar"
import { StatusDot } from "@/components/ui/status-dot"
import { GmailOutreachModal } from "@/components/gmail-outreach-modal"
import { GmailLogo } from "@/components/gmail-logo"
import { ScheduleInterviewModal } from "@/components/schedule-interview-modal"
import { RejectModal } from "@/components/reject-modal"
import { MakeOfferModal } from "@/components/make-offer-modal"
import { ROUTES, getInitials } from "@/lib/constants"
import { useApi } from "@/hooks/use-api"
import type { Candidate, RankingResult, CandidateRecord } from "@/lib/api"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface ResumeDrawerProps {
  candidate: Candidate | null
  result?: RankingResult | null
  onClose: () => void
  onAddToPool?: (candidateId: string, name: string) => void
  onEmail?: (candidateId: string, name: string) => void
}

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

function ringColorFor(score: number): string {
  if (score >= 0.7) return "#16A34A"
  if (score >= 0.5) return "#D97706"
  return "#DC2626"
}

function cleanUrlLabel(url: string): string {
  try {
    const withProto = url.startsWith("http") ? url : `https://${url}`
    const u = new URL(withProto)
    const path = u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "")
    return `${u.hostname.replace(/^www\./, "")}${path}`.slice(0, 42)
  } catch {
    return url.slice(0, 42)
  }
}

function ensureHref(url: string): string {
  return url.startsWith("http") ? url : `https://${url}`
}

interface SocialLinks {
  linkedin?: string
  github?: string
  leetcode?: string
  portfolio?: string
}

function extractSocialLinks(texts: Array<string | undefined>): SocialLinks {
  const combined = texts.filter(Boolean).join("\n")
  if (!combined) return {}
  const found: string[] = []
  const urlRe = /(https?:\/\/[^\s,;)]+|(?:www\.)?[a-z0-9-]+\.(?:com|dev|io|me|co|in|net|org)[^\s,;)]*)/gi
  const matches = combined.match(urlRe) || []
  for (const m of matches) {
    const cleaned = m.replace(/[.,;)]+$/, "")
    if (cleaned.length > 4 && !found.includes(cleaned)) found.push(cleaned)
  }
  const links: SocialLinks = {}
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
  if (other && !links.portfolio) links.portfolio = other
  return links
}

export function ResumeDrawer({ candidate, result, onClose, onAddToPool, onEmail }: ResumeDrawerProps) {
  const router = useRouter()
  const api = useApi()
  const [record, setRecord] = useState<CandidateRecord | null>(null)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showOfferModal, setShowOfferModal] = useState(false)
  const [screening, setScreening] = useState(false)
  const [localStatus, setLocalStatus] = useState<string | undefined>(undefined)
  const [copied, setCopied] = useState(false)
  const [prevCandidateId, setPrevCandidateId] = useState<string | undefined>(undefined)

  // Reset per-candidate state when a different candidate is opened.
  // (Render-time adjustment — avoids cascading renders from effects.)
  if (candidate?.id !== prevCandidateId) {
    setPrevCandidateId(candidate?.id)
    setRecord(null)
    setLocalStatus(undefined)
  }

  useEffect(() => {
    if (!candidate) return
    let cancelled = false
    async function load() {
      try {
        const res = await api.getCandidateRecord(candidate!.id)
        if (!cancelled && res.success && res.data) {
          setRecord(res.data)
          setLocalStatus(res.data.current_status)
        }
      } catch {
        // keep light candidate data on failure
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate?.id])

  if (!candidate) return null

  const scores = result?.scores
  const overall = scores?.overall
  const overallValid = typeof overall === "number" && Number.isFinite(overall)
  const explanation = result?.explanation

  const email = record?.email || candidate.email
  const phone = record?.phone || candidate.phone
  const location = record?.location
  const currentTitle = record?.current_title
  const currentCompany = record?.current_company
  const totalExp = record?.total_experience_years ?? candidate.experience
  const status = localStatus ?? record?.current_status ?? "Applied"
  const skills = (record?.skills && record.skills.length > 0 ? record.skills : candidate.skills) || []
  const summary = candidate.summary
  const titleLine =
    (currentTitle || "") +
    (currentTitle && currentCompany ? " · " : "") +
    (currentCompany || "")

  const social = extractSocialLinks([summary, record?.raw_resume_text])
  const hasContact = !!(email || phone || location)
  const hasSnapshot = totalExp !== undefined || currentTitle || location || candidate.education?.level
  const hasLinks = !!(social.linkedin || social.github || social.portfolio || social.leetcode)

  async function handleScreening() {
    if (!candidate) return
    setScreening(true)
    try {
      const res = await api.updateCandidateStatus(candidate.id, "Screening")
      if (res.success) {
        setLocalStatus("Screening")
        toast.success("Candidate moved to Screening")
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
    if (!email) return
    try {
      await navigator.clipboard.writeText(email)
      setCopied(true)
      toast.success("Email copied")
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Failed to copy email")
    }
  }

  const isTerminal = status === "Rejected"
  const isHired = status === "Hired"

  return (
    <AnimatePresence>
      {candidate && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/30"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="fixed bottom-0 right-0 top-0 z-50 flex w-full flex-col border-l border-border bg-surface shadow-2xl sm:max-w-[480px] lg:w-[42vw] lg:max-w-[580px] xl:max-w-[600px]"
            role="dialog"
            aria-label={`Candidate preview — ${candidate.name}`}
          >
            {/* Header */}
            <div className="shrink-0 border-b border-border bg-surface px-4 pb-3 pt-4 sm:px-5">
              <div className="flex items-start gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-soft ring-1 ring-border">
                  <span className="text-[15px] font-semibold text-muted">
                    {getInitials(candidate.name)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h2 className="truncate text-[16px] font-semibold tracking-tight text-ink">
                      {candidate.name}
                    </h2>
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
                  {titleLine ? (
                    <p className="mt-0.5 truncate text-[12.5px] text-muted">{titleLine}</p>
                  ) : (
                    <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-muted">
                      <Briefcase className="size-3" strokeWidth={1.75} />
                      {totalExp ?? candidate.experience}y experience
                    </p>
                  )}
                  {overallValid && (
                    <div className="mt-1 flex items-center gap-1.5 text-[12px]">
                      <Sparkles className="size-3 text-warning" strokeWidth={1.75} />
                      <span className="font-data font-semibold text-ink">{Math.round(overall! * 100)}% match</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-secondary hover:text-ink"
                  aria-label="Close preview"
                >
                  <X className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </div>

              {/* Status actions */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <Button
                  variant="outline"
                  size="xs"
                  onClick={handleScreening}
                  disabled={screening || isTerminal || status === "Screening"}
                  className="h-8 border-amber-500/25 text-[12px] text-amber-700 hover:bg-amber-500/10 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
                >
                  <Search className="size-3.5" strokeWidth={1.75} />
                  {screening ? "Updating..." : "Screening"}
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => setShowScheduleModal(true)}
                  disabled={isTerminal}
                  className="h-8 border-blue-500/25 text-[12px] text-blue-700 hover:bg-blue-500/10 dark:text-blue-400"
                >
                  <Calendar className="size-3.5" strokeWidth={1.75} />
                  Interview
                </Button>
                <Button
                  size="xs"
                  onClick={() => setShowOfferModal(true)}
                  disabled={isTerminal || isHired}
                  className="h-8 bg-green-600 text-[12px] text-white hover:bg-green-700"
                >
                  <CircleCheck className="size-3.5" strokeWidth={1.75} />
                  Hire
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => setShowRejectModal(true)}
                  disabled={isTerminal}
                  className="h-8 border-red-500/25 text-[12px] text-red-600 hover:bg-red-500/10 dark:text-red-400"
                >
                  <CircleX className="size-3.5" strokeWidth={1.75} />
                  Reject
                </Button>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              <div className="space-y-4">
                {/* Match snapshot */}
                {overallValid && scores && (
                  <section className="rounded-xl border border-border bg-surface-secondary/30 p-3.5">
                    <div className="flex items-center gap-3">
                      <ScoreRing value={overall!} size={52} color={ringColorFor(overall!)} />
                      <div className="min-w-0 flex-1 space-y-2">
                        {typeof scores.skill === "number" && (
                          <ProgressBar
                            value={scores.skill * 100}
                            label="Skill Match"
                            size="sm"
                            color={scores.skill >= 0.7 ? "bg-success" : scores.skill >= 0.5 ? "bg-warning" : "bg-danger"}
                          />
                        )}
                        {typeof scores.experience === "number" && (
                          <ProgressBar
                            value={scores.experience * 100}
                            label="Experience"
                            size="sm"
                            color={scores.experience >= 0.7 ? "bg-success" : scores.experience >= 0.5 ? "bg-warning" : "bg-danger"}
                          />
                        )}
                      </div>
                    </div>
                    {explanation && (
                      <div className="mt-2.5 rounded-lg border border-border bg-surface p-2.5">
                        <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-muted">
                          <Sparkles className="size-3 text-warning" strokeWidth={1.75} />
                          AI reasoning
                        </p>
                        <p className="line-clamp-3 text-[12px] leading-relaxed text-muted">{explanation}</p>
                      </div>
                    )}
                  </section>
                )}

                {/* Profile snapshot */}
                {hasSnapshot && (
                  <section>
                    <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.07em] text-faint">
                      Profile snapshot
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {totalExp !== undefined && (
                        <div className="rounded-lg border border-border p-2.5">
                          <p className="flex items-center gap-1 text-[10px] uppercase tracking-[0.05em] text-faint">
                            <Briefcase className="size-3" strokeWidth={1.75} />
                            Experience
                          </p>
                          <p className="mt-1 text-[13px] font-semibold text-ink">{totalExp} years</p>
                        </div>
                      )}
                      {(currentTitle || currentCompany) && (
                        <div className="rounded-lg border border-border p-2.5">
                          <p className="flex items-center gap-1 text-[10px] uppercase tracking-[0.05em] text-faint">
                            <Building2 className="size-3" strokeWidth={1.75} />
                            Current role
                          </p>
                          <p className="mt-1 truncate text-[12.5px] font-medium text-ink">
                            {currentTitle || "—"}
                          </p>
                          {currentCompany && (
                            <p className="truncate text-[11.5px] text-muted">{currentCompany}</p>
                          )}
                        </div>
                      )}
                      {location && (
                        <div className="rounded-lg border border-border p-2.5">
                          <p className="flex items-center gap-1 text-[10px] uppercase tracking-[0.05em] text-faint">
                            <MapPin className="size-3" strokeWidth={1.75} />
                            Location
                          </p>
                          <p className="mt-1 truncate text-[12.5px] font-medium text-ink">{location}</p>
                        </div>
                      )}
                      {candidate.education?.level && (
                        <div className="rounded-lg border border-border p-2.5">
                          <p className="flex items-center gap-1 text-[10px] uppercase tracking-[0.05em] text-faint">
                            <GraduationCap className="size-3" strokeWidth={1.75} />
                            Education
                          </p>
                          <p className="mt-1 text-[12.5px] font-medium capitalize text-ink">
                            {candidate.education.level}
                            {candidate.education.field ? ` · ${candidate.education.field}` : ""}
                          </p>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {/* Skills */}
                {skills.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.07em] text-faint">
                      Skills · {skills.length}
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {skills.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-md border border-border bg-surface-secondary/60 px-2 py-1 text-[11.5px] text-muted"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </section>
                )}

                {/* Contact */}
                {hasContact && (
                  <section>
                    <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.07em] text-faint">
                      Contact
                    </h3>
                    <div className="space-y-1.5">
                      {email && (
                        <div className="flex items-center gap-2.5 rounded-lg border border-border p-2.5">
                          <Mail className="size-3.5 shrink-0 text-faint" strokeWidth={1.75} />
                          <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{email}</span>
                          <button
                            onClick={handleCopyEmail}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-secondary hover:text-ink"
                            aria-label="Copy email"
                            title="Copy email"
                          >
                            {copied ? (
                              <Check className="size-3.5 text-success" strokeWidth={1.75} />
                            ) : (
                              <Copy className="size-3.5" strokeWidth={1.75} />
                            )}
                          </button>
                        </div>
                      )}
                      {phone && (
                        <div className="flex items-center gap-2.5 rounded-lg border border-border p-2.5">
                          <Phone className="size-3.5 shrink-0 text-faint" strokeWidth={1.75} />
                          <span className="truncate text-[12.5px] text-ink">{phone}</span>
                        </div>
                      )}
                      {location && (
                        <div className="flex items-center gap-2.5 rounded-lg border border-border p-2.5">
                          <MapPin className="size-3.5 shrink-0 text-faint" strokeWidth={1.75} />
                          <span className="truncate text-[12.5px] text-ink">{location}</span>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {/* Professional links — only real links */}
                {hasLinks && (
                  <section>
                    <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.07em] text-faint">
                      Links
                    </h3>
                    <div className="space-y-1.5">
                      {social.linkedin && (
                        <a
                          href={ensureHref(social.linkedin)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2.5 rounded-lg border border-border p-2.5 transition-colors hover:border-border-hover hover:bg-surface-secondary/50"
                        >
                          <BriefcaseBusiness className="size-3.5 shrink-0 text-[#0A66C2]" strokeWidth={1.75} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[12px] font-medium text-ink">LinkedIn</span>
                            <span className="block truncate text-[11px] text-faint">{cleanUrlLabel(social.linkedin)}</span>
                          </span>
                        </a>
                      )}
                      {social.github && (
                        <a
                          href={ensureHref(social.github)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2.5 rounded-lg border border-border p-2.5 transition-colors hover:border-border-hover hover:bg-surface-secondary/50"
                        >
                          <FolderGit2 className="size-3.5 shrink-0 text-ink" strokeWidth={1.75} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[12px] font-medium text-ink">GitHub</span>
                            <span className="block truncate text-[11px] text-faint">{cleanUrlLabel(social.github)}</span>
                          </span>
                        </a>
                      )}
                      {social.portfolio && (
                        <a
                          href={ensureHref(social.portfolio)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2.5 rounded-lg border border-border p-2.5 transition-colors hover:border-border-hover hover:bg-surface-secondary/50"
                        >
                          <Globe className="size-3.5 shrink-0 text-info" strokeWidth={1.75} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[12px] font-medium text-ink">Portfolio</span>
                            <span className="block truncate text-[11px] text-faint">{cleanUrlLabel(social.portfolio)}</span>
                          </span>
                        </a>
                      )}
                      {social.leetcode && (
                        <a
                          href={ensureHref(social.leetcode)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2.5 rounded-lg border border-border p-2.5 transition-colors hover:border-border-hover hover:bg-surface-secondary/50"
                        >
                          <Code2 className="size-3.5 shrink-0 text-warning" strokeWidth={1.75} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[12px] font-medium text-ink">LeetCode</span>
                            <span className="block truncate text-[11px] text-faint">{cleanUrlLabel(social.leetcode)}</span>
                          </span>
                        </a>
                      )}
                    </div>
                  </section>
                )}

                {/* Summary */}
                {summary && (
                  <section className="rounded-xl border border-border bg-surface-secondary/30 p-3.5">
                    <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-faint">
                      <User className="size-3" strokeWidth={1.75} />
                      Summary
                    </p>
                    <p className="line-clamp-4 text-[12.5px] leading-relaxed text-muted">{summary}</p>
                  </section>
                )}

                {!hasContact && !hasLinks && skills.length === 0 && (
                  <p className="py-4 text-center text-[12.5px] text-faint">
                    No additional details on file for this candidate.
                  </p>
                )}
              </div>
            </div>

            {/* Footer actions */}
            <div className="shrink-0 border-t border-border bg-surface px-4 py-3 sm:px-5">
              <div className="flex gap-2">
                <Button
                  className="h-9 flex-1 text-[13px]"
                  onClick={() => router.push(ROUTES.candidateDetail(candidate.id))}
                >
                  View Full Profile
                  <ArrowRight className="size-3.5" strokeWidth={1.75} />
                </Button>
                <Button
                  variant="outline"
                  className="h-9 flex-1 text-[13px]"
                  disabled={!email}
                  title={email ? `Send outreach to ${candidate.name}` : "No email on file for this candidate"}
                  onClick={() => {
                    if (onEmail) {
                      onEmail(candidate.id, candidate.name)
                    } else {
                      setShowEmailModal(true)
                    }
                  }}
                >
                  <GmailLogo className="size-4" />
                  Send Email
                </Button>
              </div>
              {onAddToPool && (
                <button
                  onClick={() => onAddToPool(candidate.id, candidate.name)}
                  className="mt-2 w-full text-center text-[12px] font-medium text-muted transition-colors hover:text-ink"
                >
                  + Add to talent pool
                </button>
              )}
              {!email && (
                <p className="mt-1.5 text-center text-[11px] text-faint">No email on file</p>
              )}
            </div>
          </motion.div>

          {showEmailModal && email && (
            <GmailOutreachModal
              open={showEmailModal}
              onClose={() => setShowEmailModal(false)}
              candidateId={candidate.id}
              candidateName={candidate.name}
              candidateEmail={email}
            />
          )}

          <ScheduleInterviewModal
            open={showScheduleModal}
            onClose={() => setShowScheduleModal(false)}
            candidateId={candidate.id}
            onSuccess={() => {
              setLocalStatus("Interview Scheduled")
            }}
          />
          <RejectModal
            open={showRejectModal}
            onClose={() => setShowRejectModal(false)}
            candidateId={candidate.id}
            onSuccess={() => {
              setLocalStatus("Rejected")
            }}
          />
          <MakeOfferModal
            open={showOfferModal}
            onClose={() => setShowOfferModal(false)}
            candidateId={candidate.id}
            onSuccess={() => {
              setLocalStatus("Offered")
            }}
          />
        </>
      )}
    </AnimatePresence>
  )
}
