"use client"

import { useState, useCallback, useEffect, useRef, memo } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  Sparkles, Link2, RefreshCw, Loader2, ShieldAlert, Plus,
  FilePlus, Copy, Check, Users, FileText,
  BadgeCheck, LayoutDashboard,
  Search, Bell, ArrowUpRight, TrendingUp, Clock, Briefcase,
  Eye, Bot, Brain, Target, BarChart3, Calendar,
  ChevronRight, Download, Filter,
} from "lucide-react"
import { toast } from "sonner"
import { CandidateDetailModal } from "@/components/candidate-detail-modal"
import { useApi } from "@/hooks/use-api"
import { useDashboard } from "@/hooks/use-dashboard"
import { useWebSocket } from "@/lib/use-websocket"
import { ROUTES, getInitials } from "@/lib/constants"
import type { SessionStats } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { GlassCard } from "@/components/ui/glass-card"
import { ProgressBar } from "@/components/ui/progress-bar"
import { ScoreRing } from "@/components/ui/score-ring"
import { useUser } from "@clerk/nextjs"

interface SessionData {
  sessionId: string
  link: string
}

interface CandidateRow {
  id: string
  full_name?: string
  current_company?: string
  current_title?: string
  total_experience_years?: number
  flight_risk?: string
  growth_trajectory?: string
  match_score?: number
  status?: string
  current_status?: string
  email?: string
  phone?: string
  location?: string
  raw_resume_text?: string
  skills?: string[]
  resume_file_url?: string
}

interface BiasIssue {
  category: string
  text: string
  suggestion: string
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const } },
}

function getRiskPillStyle(risk?: string) {
  const r = (risk || "").toLowerCase()
  if (r === "high") return "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20"
  if (r === "medium") return "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20"
  return "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/20"
}

function getStatusPillStyle(status?: string) {
  const s = (status || "").toLowerCase()
  if (s === "offered" || s === "hired")
    return "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/20"
  if (s === "applied")
    return "bg-[#111111]/5 text-[#111111] border-[#111111]/10"
  if (s === "interview scheduled" || s === "interview completed" || s === "technical round" || s === "hr round" || s === "screening")
    return "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20"
  if (s === "rejected")
    return "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20"
  return "bg-[#F6F6F4] text-[#6B7280] border-[#ECECEC]"
}

function statCards(stats: SessionStats | null) {
  return [
    {
      href: ROUTES.candidates,
      label: "Total Candidates",
      value: stats?.totalCandidates ?? 0,
      icon: Users,
    },
    {
      href: ROUTES.candidates,
      label: "Uploaded Today",
      value: stats?.uploadedToday ?? 0,
      icon: Clock,
    },
    {
      href: ROUTES.candidates,
      label: "In Progress",
      value: stats?.open ?? 0,
      icon: Briefcase,
      sub: `Applied: ${stats?.applied ?? 0} · Screening: ${stats?.screening ?? 0} · Interview: ${stats?.interview ?? 0}`,
    },
    {
      href: `${ROUTES.candidates}?status=hired,offer`,
      label: "Hired",
      value: (stats?.hired ?? 0) + (stats?.offered ?? 0),
      icon: BadgeCheck,
      sub: `${stats?.hired ?? 0} Hired · ${stats?.offered ?? 0} Pending`,
    },
  ]
}

function DisplayNumber({ value }: { value: number }) {
  return <>{value.toLocaleString()}</>
}

const CandidateCard = memo(function CandidateCard({
  candidate,
  onSelect,
  index,
}: {
  candidate: CandidateRow
  onSelect: (c: CandidateRow) => void
  index: number
}) {
  return (
    <motion.div
      variants={itemVariants}
      transition={{ delay: index * 0.03 }}
      className="group bg-white rounded-[24px] border border-[#ECECEC] shadow-[0_10px_40px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_60px_rgba(0,0,0,0.08)] hover:-translate-y-[6px] transition-all duration-300 cursor-pointer overflow-hidden"
      onClick={() => onSelect(candidate)}
    >
      <div className="p-6">
        <div className="flex items-start gap-4">
          <Avatar className="h-12 w-12 ring-2 ring-white shrink-0">
            <AvatarFallback className="text-sm font-medium bg-[#F6F6F4] text-[#6B7280]">
              {getInitials(candidate.full_name)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="text-sm font-medium text-[#111111]">
                {candidate.full_name || "Unknown"}
              </h3>
              {candidate.match_score !== undefined && candidate.match_score >= 85 && (
                <Sparkles className="h-3 w-3 text-[#111111]" />
              )}
            </div>
            <p className="text-xs text-[#6B7280]">
              {candidate.current_title || ""}
              {candidate.current_title && candidate.current_company ? " · " : ""}
              {candidate.current_company && (
                <span className="text-[#111111]/60">{candidate.current_company}</span>
              )}
            </p>

            <div className="flex flex-wrap items-center gap-2 mt-4">
              {(candidate.skills || []).slice(0, 3).map((skill, j) => (
                <span key={j} className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#F6F6F4] text-[#6B7280]">
                  {skill}
                </span>
              ))}
              {(candidate.skills?.length || 0) > 3 && (
                <span className="text-[11px] text-[#A3A3A3] font-medium">
                  +{(candidate.skills?.length || 0) - 3} more
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 mt-4">
              {candidate.total_experience_years != null && (
                <span className="text-[11px] text-[#A3A3A3]">{candidate.total_experience_years}y experience</span>
              )}
              {candidate.location && (
                <span className="text-[11px] text-[#A3A3A3]">{candidate.location}</span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-16 h-1.5 bg-[#ECECEC] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#111111] rounded-full transition-all"
                  style={{ width: `${Math.round(candidate.match_score ?? 0)}%` }}
                />
              </div>
              <span className="text-xs font-medium text-[#111111] tabular-nums">
                {candidate.match_score !== undefined ? `${Math.round(candidate.match_score)}%` : "—"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-medium border ${getStatusPillStyle(candidate.current_status || candidate.status)}`}>
                {candidate.current_status || candidate.status || "Applied"}
              </span>
              {candidate.flight_risk && (
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-medium border ${getRiskPillStyle(candidate.flight_risk)}`}>
                  {candidate.flight_risk} risk
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {candidate.resume_file_url && (
                <a
                  href={candidate.resume_file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[#A3A3A3] hover:text-[#111111] hover:bg-[#F6F6F4] transition-all"
                >
                  <FileText className="h-3.5 w-3.5" strokeWidth={1.5} />
                </a>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onSelect(candidate) }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#A3A3A3] hover:text-[#111111] hover:bg-[#F6F6F4] transition-all"
              >
                <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
})

export default function DashboardPage() {
  const [jdText, setJdText] = useState("")
  const [session, setSession] = useState<SessionData | null>(null)
  const [generating, setGenerating] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateRow | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)
  const [scanningBias, setScanningBias] = useState(false)
  const [biasResult, setBiasResult] = useState<{ has_bias: boolean; issues: BiasIssue[]; suggestions: string[] } | null>(null)
  const [biasError, setBiasError] = useState("")
  const [page] = useState(1)
  const wsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const api = useApi()
  const { user } = useUser()
  const { data, stats, candidates, sessions: sessList, isLoading, isValidating, mutate } = useDashboard(page, 50)

  useEffect(() => {
    if (!data) return
    const latestSession = sessList?.[0]
    if (latestSession && !session) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSession({ sessionId: latestSession.id, link: `/upload/${latestSession.id}` })
      setJdText(latestSession.job_description_text)
    }
  }, [data, sessList, session])

  useWebSocket('candidate:status_changed', useCallback(() => {
    if (wsDebounceRef.current) clearTimeout(wsDebounceRef.current)
    wsDebounceRef.current = setTimeout(() => mutate(), 500)
  }, [mutate]))

  const generateLink = useCallback(async () => {
    if (!jdText.trim()) return
    setGenerating(true)
    setError("")
    try {
      const res = await api.generateLink(jdText)
      if (res.success && res.data) {
        const { sessionId, link } = res.data
        setSession({ sessionId, link })
        mutate()
        toast.success("Application link generated!")
      } else {
        setError(res.error || "Failed to generate link")
      }
    } catch {
      setError("Failed to connect to server")
    } finally {
      setGenerating(false)
    }
  }, [jdText, api, mutate])

  const handleBiasScan = useCallback(async () => {
    if (!jdText.trim()) return
    setScanningBias(true)
    setBiasResult(null)
    setBiasError("")
    try {
      const result = await api.scanBias(jdText)
      if (result.success && result.data) {
        setBiasResult(result.data)
        if (result.data.has_bias) {
          toast.warning(`${result.data.issues.length} bias issue(s) detected`)
        } else {
          toast.success("No bias detected!")
        }
      } else {
        setBiasError(result.error || "Bias scan failed")
      }
    } catch {
      setBiasError("Failed to scan for bias")
    } finally {
      setScanningBias(false)
    }
  }, [jdText, api])

  const handleNewSession = () => {
    setSession(null)
    setJdText("")
    setBiasResult(null)
    setError("")
    mutate()
    toast.success("New session started")
  }

  const handleSelectCandidate = (candidate: CandidateRow) => {
    setSelectedCandidate(candidate)
    setShowDetailModal(true)
  }

  const handleCopyLink = async () => {
    const url = typeof window !== "undefined"
      ? `${window.location.origin}${session?.link}`
      : session?.link || ""
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const input = document.createElement("textarea")
      input.value = url
      document.body.appendChild(input)
      input.select()
      document.execCommand("copy")
      document.body.removeChild(input)
    }
    setCopied(true)
    toast.success("Copied to clipboard!")
    setTimeout(() => setCopied(false), 2000)
  }

  const statsList = statCards(stats)

  if (isLoading && !data) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-[16px] bg-[#111111] flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div className="space-y-2 text-center">
            <div className="h-3 w-32 bg-[#ECECEC] rounded-full animate-pulse-soft mx-auto" />
            <div className="h-2 w-24 bg-[#ECECEC] rounded-full animate-pulse-soft mx-auto" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="pt-6 space-y-12"
    >
      {/* AI Hiring Workspace */}
      <motion.div variants={itemVariants}>
        <div className="bg-white rounded-[24px] border border-[#ECECEC] shadow-[0_10px_40px_rgba(0,0,0,0.05)] p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-10 w-10 rounded-[14px] bg-[#111111] flex items-center justify-center">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-medium text-[#111111]">AI Hiring Workspace</h2>
              <p className="text-sm text-[#6B7280] mt-0.5">
                Paste a job description to generate an AI-powered hiring session
              </p>
            </div>
          </div>

          <Textarea
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            placeholder="Paste the full job description here. The AI will parse this to match candidates..."
            rows={5}
            className="w-full resize-none text-sm leading-relaxed mb-4"
          />

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}

          {biasResult && biasResult.has_bias && (
            <Alert variant="warning" className="mb-4">
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription>
                <p className="text-sm font-medium mb-2">{biasResult.issues.length} bias issue(s) found</p>
                {biasResult.issues.slice(0, 2).map((issue, i) => (
                  <p key={i} className="text-xs mb-1">[{issue.category}] {issue.suggestion}</p>
                ))}
              </AlertDescription>
            </Alert>
          )}

          {biasResult && !biasResult.has_bias && (
            <Alert variant="success" className="mb-4">
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription className="text-sm font-medium">
                No bias detected — JD looks great!
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {session && (
                <Button variant="ghost" size="sm" onClick={() => mutate()} disabled={isValidating}>
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isValidating ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={handleBiasScan} disabled={scanningBias || !jdText.trim()}>
                {scanningBias ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <ShieldAlert className="h-3.5 w-3.5 mr-1.5" />
                )}
                {scanningBias ? "Scanning..." : "Check Bias"}
              </Button>
              <Button size="sm" onClick={generateLink} disabled={generating || !jdText.trim()} className="bg-[#111111] text-white hover:bg-[#2A2A2A]">
                {generating ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-1.5" />
                )}
                {generating ? "Generating..." : "Generate Link"}
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {session && (
        <motion.div variants={itemVariants}>
          <div className="bg-white rounded-[24px] border border-[#ECECEC] shadow-[0_10px_40px_rgba(0,0,0,0.05)] p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-[#F6F6F4] flex items-center justify-center">
                  <Link2 className="h-4 w-4 text-[#111111]" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-xs font-medium text-[#6B7280]">Active Application Link</p>
                  <code className="text-sm font-mono text-[#111111]">
                    {typeof window !== "undefined"
                      ? `${window.location.origin}${session.link}`
                      : session.link}
                  </code>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleCopyLink}>
                  {copied ? (
                    <Check className="h-3.5 w-3.5 mr-1.5 text-[#16A34A]" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button variant="outline" size="sm" onClick={handleNewSession}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  New Session
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Pipeline Overview */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-medium text-[#111111] tracking-tight">Pipeline Overview</h2>
            <p className="text-sm text-[#6B7280] mt-1">Track your hiring progress at a glance</p>
          </div>
          <Link href={ROUTES.candidates} className="text-sm font-medium text-[#111111] hover:text-[#6B7280] transition-colors inline-flex items-center gap-1">
            View all
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-4 gap-6">
          {statsList.map((card, i) => (
            <motion.div
              key={card.label}
              variants={itemVariants}
              transition={{ delay: i * 0.05 }}
            >
              <Link href={card.href} className="block group">
                <div className="bg-white rounded-[24px] border border-[#ECECEC] shadow-[0_10px_40px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_60px_rgba(0,0,0,0.08)] hover:-translate-y-[6px] transition-all duration-300 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wider">{card.label}</p>
                    <div className="h-9 w-9 rounded-full bg-[#F6F6F4] flex items-center justify-center">
                      <card.icon className="h-4 w-4 text-[#111111]" strokeWidth={1.5} />
                    </div>
                  </div>
                  <p className="text-[34px] font-medium text-[#111111] leading-none tracking-tight tabular-nums">
                    <DisplayNumber value={card.value} />
                  </p>
                  {card.sub && (
                    <p className="text-xs text-[#6B7280] mt-3 leading-relaxed">{card.sub}</p>
                  )}
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* AI Insights + Recent Candidates */}
      <div className="grid grid-cols-3 gap-8">
        {/* AI Insights */}
        <motion.div variants={itemVariants} className="col-span-1">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-medium text-[#111111] tracking-tight">AI Insights</h2>
              <p className="text-sm text-[#6B7280] mt-1">Intelligence from your pipeline</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-[rgba(255,255,255,0.7)] backdrop-blur-[20px] rounded-[24px] border border-[rgba(236,236,236,0.5)] p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-8 w-8 rounded-[10px] bg-[#F6F6F4] flex items-center justify-center">
                  <Brain className="h-4 w-4 text-[#111111]" strokeWidth={1.5} />
                </div>
                <h3 className="text-sm font-medium text-[#111111]">AI Match Analysis</h3>
              </div>

              <div className="flex items-center justify-center py-4">
                <ScoreRing
                  value={(candidates.reduce((s, c) => s + (c.match_score ?? 0), 0) / Math.max(candidates.length, 1)) / 100}
                  size={96}
                  strokeWidth={3}
                  color="#111111"
                  label="Avg Match Score"
                  delay={0.2}
                />
              </div>

              <div className="space-y-3 mt-4">
                <ProgressBar
                  value={candidates.filter(c => (c.match_score ?? 0) >= 80).length / Math.max(candidates.length, 1) * 100}
                  label="Strong Matches (80%+)"
                  size="sm"
                  delay={0.3}
                />
                <ProgressBar
                  value={candidates.filter(c => (c.match_score ?? 0) >= 50 && (c.match_score ?? 0) < 80).length / Math.max(candidates.length, 1) * 100}
                  label="Moderate Matches (50-80%)"
                  size="sm"
                  color="bg-[#6B7280]"
                  delay={0.4}
                />
              </div>
            </div>

            <div className="bg-[rgba(255,255,255,0.7)] backdrop-blur-[20px] rounded-[24px] border border-[rgba(236,236,236,0.5)] p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-8 w-8 rounded-[10px] bg-[#F6F6F4] flex items-center justify-center">
                  <Target className="h-4 w-4 text-[#111111]" strokeWidth={1.5} />
                </div>
                <h3 className="text-sm font-medium text-[#111111]">Pipeline Health</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#111111]" />
                    <span className="text-xs text-[#6B7280]">Applied</span>
                  </div>
                  <span className="text-xs font-medium text-[#111111] tabular-nums">{stats?.applied ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                    <span className="text-xs text-[#6B7280]">Screening</span>
                  </div>
                  <span className="text-xs font-medium text-[#111111] tabular-nums">{stats?.screening ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#6B7280]" />
                    <span className="text-xs text-[#6B7280]">Interview</span>
                  </div>
                  <span className="text-xs font-medium text-[#111111] tabular-nums">{stats?.interview ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#16A34A]" />
                    <span className="text-xs text-[#6B7280]">Hired</span>
                  </div>
                  <span className="text-xs font-medium text-[#111111] tabular-nums">{stats?.hired ?? 0}</span>
                </div>
              </div>
            </div>

            <div className="bg-[rgba(255,255,255,0.7)] backdrop-blur-[20px] rounded-[24px] border border-[rgba(236,236,236,0.5)] p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-8 w-8 rounded-[10px] bg-[#F6F6F4] flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-[#111111]" strokeWidth={1.5} />
                </div>
                <h3 className="text-sm font-medium text-[#111111]">Upcoming Interviews</h3>
              </div>
              <p className="text-[32px] font-medium text-[#111111] tabular-nums">{stats?.interview ?? 0}</p>
              <p className="text-xs text-[#6B7280] mt-1">Today: {stats?.interviewsToday ?? 0}</p>
            </div>
          </div>
        </motion.div>

        {/* Recent Candidates */}
        <motion.div variants={itemVariants} className="col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-medium text-[#111111] tracking-tight">Recent Candidates</h2>
              <p className="text-sm text-[#6B7280] mt-1">
                {candidates.length > 0
                  ? `${candidates.length} candidate${candidates.length === 1 ? '' : 's'} in your pipeline`
                  : "Start receiving candidates"}
              </p>
            </div>
            {candidates.length > 0 && (
              <Link href={`${ROUTES.candidates}?session=${session?.sessionId}`}>
                <Button variant="outline" size="sm">
                  View All
                  <ArrowUpRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              </Link>
            )}
          </div>

          {isValidating && !candidates.length ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white rounded-[24px] border border-[#ECECEC] p-6">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-3">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                      <div className="flex gap-2">
                        <Skeleton className="h-6 w-16 rounded-full" />
                        <Skeleton className="h-6 w-20 rounded-full" />
                        <Skeleton className="h-6 w-14 rounded-full" />
                      </div>
                    </div>
                    <Skeleton className="h-8 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : candidates.length === 0 ? (
            <div className="bg-white rounded-[24px] border border-[#ECECEC] shadow-[0_10px_40px_rgba(0,0,0,0.05)] p-16">
              <div className="flex flex-col items-center text-center max-w-sm mx-auto">
                <div className="h-16 w-16 rounded-[20px] bg-[#F6F6F4] flex items-center justify-center mb-5">
                  <Users className="h-7 w-7 text-[#A3A3A3]" strokeWidth={1.5} />
                </div>
                <h3 className="text-base font-medium text-[#111111] mb-1">No candidates yet</h3>
                <p className="text-sm text-[#6B7280] mb-6 leading-relaxed">
                  Upload a resume or create an application link above to start receiving candidates.
                </p>
                <div className="flex gap-3">
                  <Button size="sm" onClick={() => { const el = document.querySelector('textarea'); if (el) el.focus() }} className="bg-[#111111] text-white hover:bg-[#2A2A2A]">
                    <FilePlus className="h-4 w-4 mr-1.5" />
                    Paste Job Description
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleNewSession}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Create Session
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {candidates.slice(0, 5).map((candidate, index) => (
                <CandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  onSelect={handleSelectCandidate}
                  index={index}
                />
              ))}
            </div>
          )}
        </motion.div>
      </div>

      <CandidateDetailModal
        open={showDetailModal}
        onClose={() => {
          setShowDetailModal(false)
          setSelectedCandidate(null)
        }}
        candidate={selectedCandidate}
        onStatusChange={() => mutate()}
      />
    </motion.div>
  )
}
