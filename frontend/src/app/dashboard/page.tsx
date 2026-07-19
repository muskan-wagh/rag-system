"use client"

import { useState, useCallback, useEffect, useRef, memo } from "react"
import Link from "next/link"
import { motion } from "framer-motion"

import {
  Sparkles, Link2, RefreshCw, Loader2, ShieldAlert, Plus,
  FilePlus, Copy, Check, Users, FileText,
  BadgeCheck, LayoutDashboard,
  Search, Bell, ArrowUpRight, TrendingUp, Clock, Briefcase,
  Eye,
} from "lucide-react"
import { toast } from "sonner"
import { CandidateDetailModal } from "@/components/candidate-detail-modal"
import { useApi } from "@/hooks/use-api"
import { useDashboard } from "@/hooks/use-dashboard"
import { useWebSocket } from "@/lib/use-websocket"
import { ROUTES, getStatusColor, getInitials, CANDIDATE_STATUS } from "@/lib/constants"
import type { SessionStats } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
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

const CandidateTableRow = memo(function CandidateTableRow({
  candidate,
  onSelect,
}: {
  candidate: CandidateRow
  onSelect: (c: CandidateRow) => void
}) {
  return (
    <TableRow className="hover:bg-white/40 transition-colors">
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 ring-2 ring-white shadow-sm">
            <AvatarFallback className="text-xs bg-primary/5 text-primary font-semibold">
              {getInitials(candidate.full_name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium text-foreground">{candidate.full_name || "Unknown"}</p>
            <p className="text-xs text-muted-foreground">
              {candidate.current_title || ""}
              {candidate.current_title && candidate.current_company ? " @ " : ""}
              {candidate.current_company || ""}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2.5">
          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full"
              style={{ width: `${Math.round(candidate.match_score ?? 0)}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-foreground tabular-nums">
            {candidate.match_score !== undefined ? `${Math.round(candidate.match_score)}%` : "—"}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
          candidate.flight_risk === "High"
            ? "bg-red-50 border-red-200 text-red-600"
            : candidate.flight_risk === "Medium"
            ? "bg-amber-50 border-amber-200 text-amber-600"
            : "bg-green-50 border-success text-success"
        }`}>
          {candidate.flight_risk || "Unknown"}
        </span>
      </TableCell>
      <TableCell>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(candidate.current_status || candidate.status)}`}>
          {candidate.current_status || candidate.status || CANDIDATE_STATUS.APPLIED}
        </span>
      </TableCell>
      <TableCell>
        {candidate.resume_file_url ? (
          <a
            href={candidate.resume_file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/60 transition-all border border-transparent hover:border-border/40"
          >
            <FileText className="h-3.5 w-3.5" />
            Resume
          </a>
        ) : (
          <span className="text-xs text-muted-foreground/50">—</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <button
          onClick={() => onSelect(candidate)}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-primary hover:text-primary/80 hover:bg-primary/5 transition-all"
        >
          <Eye className="h-3.5 w-3.5" />
          View
        </button>
      </TableCell>
    </TableRow>
  )
})

function getStatValue(stats: SessionStats | null, card: typeof statCards[number]): number {
  if (card.getValue) return card.getValue(stats)
  const valueMap: Record<string, number | undefined> = {
    open: stats?.open,
    hired: stats?.hired,
    totalCandidates: stats?.totalCandidates,
    uploadedToday: stats?.uploadedToday,
  }
  return valueMap[card.valueKey] ?? 0
}

const statCards = [
  {
    href: ROUTES.candidates,
    label: "Total Candidates",
    valueKey: "totalCandidates" as const,
    icon: Users,
    gradient: "from-primary to-accent",
    bgLight: "bg-primary/5",
    trend: "+12% this week",
  },
  {
    href: ROUTES.candidates,
    label: "Uploaded Today",
    valueKey: "uploadedToday" as const,
    icon: Clock,
    gradient: "from-blue-500 to-indigo-400",
    bgLight: "bg-blue-500/5",
    trend: null,
  },
  {
    href: ROUTES.candidates,
    label: "In Progress",
    valueKey: "open" as const,
    icon: Briefcase,
    gradient: "from-amber-500 to-orange-400",
    bgLight: "bg-amber-500/5",
    trend: null,
    sub: (stats: SessionStats | null) => `${stats?.applied ?? 0} Applied · ${stats?.screening ?? 0} Screening · ${stats?.interview ?? 0} Interview`,
  },
  {
    href: `${ROUTES.candidates}?status=hired,offer`,
    label: "Hired",
    valueKey: "hired" as const,
    icon: BadgeCheck,
    gradient: "from-primary to-accent",
    bgLight: "bg-green-500/5",
    trend: null,
    getValue: (stats: SessionStats | null) => (stats?.hired ?? 0) + (stats?.offered ?? 0),
    sub: (stats: SessionStats | null) => `${stats?.hired ?? 0} Hired · ${stats?.offered ?? 0} Pending`,
  },
]

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

  // Sync session + JD from SWR data
  useEffect(() => {
    if (!data) return
    const latestSession = sessList?.[0]
    if (latestSession) {
      setSession({ sessionId: latestSession.id, link: `/upload/${latestSession.id}` })
      setJdText(latestSession.job_description_text)
    }
  }, [data, sessList])

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning"
    if (hour < 17) return "Good afternoon"
    return "Good evening"
  }

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
    } catch (err) {
      if (err instanceof Error && err.message === "auth") {
        setError("Session expired. Please log in again.")
      } else {
        setError("Failed to connect to server. Please check your network connection.")
      }
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
          toast.success("No bias detected — JD looks great!")
        }
      } else {
        setBiasError(result.error || "Bias scan failed")
        toast.error(result.error || "Bias scan failed")
      }
    } catch {
      setBiasError("Failed to scan for bias")
      toast.error("Failed to scan for bias")
    } finally {
      setScanningBias(false)
    }
  }, [jdText, api])

  const handleNewSession = () => {
    setSession(null)
    setJdText("")
    setBiasResult(null)
    setError("")
    mutate(undefined, false)
    toast.info("Started a new session")
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

  if (isLoading && !data) {
    return (
      <div className="p-6 lg:p-8 min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shadow-md shadow-primary/20">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <motion.div
              animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 rounded-xl bg-primary/20"
            />
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="p-6 lg:p-8 xl:p-10 max-w-[1440px] mx-auto space-y-8"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center shadow-md shadow-primary/20">
              <LayoutDashboard className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                {getGreeting()}, {user?.firstName || "there"} — here&apos;s your hiring overview
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
            <input
              type="search"
              placeholder="Search candidates..."
              className="h-9 w-56 rounded-xl border border-border/60 bg-white/50 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all backdrop-blur-sm"
            />
          </div>
          <button className="relative h-9 w-9 rounded-xl border border-border/60 bg-white/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/80 transition-all backdrop-blur-sm">
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-white" />
          </button>
          <div className="flex items-center gap-2 pl-3 border-l border-border/40">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shadow-sm">
              {getInitials(user?.fullName || user?.primaryEmailAddress?.emailAddress || "U")}
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleNewSession}
            className="rounded-xl bg-primary text-white shadow-md shadow-primary/20 transition-all h-9 px-4"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            {session ? "New Session" : "Create Session"}
          </Button>
        </div>
      </motion.div>

      {/* AI Workspace */}
      <motion.div variants={itemVariants}>
        <div className="glass-card rounded-2xl p-6 md:p-8 border border-white/50 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-9 w-9 rounded-xl bg-primary/5 border border-primary/5 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">AI Workspace</h2>
              <p className="text-xs text-muted-foreground">Create a new application link by pasting a job description</p>
            </div>
          </div>

          <div className="relative">
            <Textarea
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder="Paste the full job description here. The AI will parse this to match candidates..."
              rows={6}
              className="w-full resize-none rounded-xl border border-border/60 bg-white/60 backdrop-blur-sm p-4 text-sm leading-relaxed placeholder:text-muted-foreground/30 focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all"
            />
            <div className="absolute bottom-3 right-3 flex items-center gap-1 text-[10px] text-muted-foreground/40 bg-white/60 backdrop-blur-sm px-2 py-1 rounded-lg">
              <FileText className="h-3 w-3" />
              {jdText.length}/5000
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="mt-4 rounded-xl border-red-200 bg-red-50/50">
              <AlertDescription className="flex items-center justify-between">
                <span className="text-sm">{error}</span>
                <Button variant="ghost" size="xs" onClick={() => { setError(""); generateLink() }} className="text-red-600 hover:text-red-700 hover:bg-red-100/50">
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {biasError && (
            <Alert variant="destructive" className="mt-4 rounded-xl border-red-200 bg-red-50/50">
              <AlertDescription className="flex items-center justify-between">
                <span className="text-sm">{biasError}</span>
                <Button variant="ghost" size="xs" onClick={handleBiasScan} className="text-red-600 hover:text-red-700 hover:bg-red-100/50">
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 mt-5">
            <div className="flex items-center gap-2">
              {session && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => mutate()}
                  disabled={isValidating}
                  className="rounded-lg text-xs h-8 text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isValidating ? "animate-spin" : ""}`} />
                  Refresh
                  {candidates.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-primary/5 px-1.5 py-0.5 text-[10px] text-primary font-medium">
                      {candidates.length}
                    </span>
                  )}
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBiasScan}
                disabled={scanningBias || !jdText.trim()}
                className="rounded-lg h-9 border-border/60 text-xs"
              >
                {scanningBias ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <ShieldAlert className="h-3.5 w-3.5 mr-1.5" />
                )}
                {scanningBias ? "Scanning..." : "Check Bias"}
              </Button>
              <Button
                size="sm"
                onClick={generateLink}
                disabled={generating || !jdText.trim()}
                className="rounded-lg h-9 bg-primary text-white shadow-md shadow-primary/20 transition-all text-xs px-5"
              >
                {generating ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                )}
                {generating ? "Generating..." : "Generate Link"}
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Active Session Link */}
      {session && (
        <motion.div variants={itemVariants}>
          <div className="glass-card rounded-2xl p-5 border border-primary/10 bg-gradient-to-r from-primary/[0.03] to-accent/[0.02] shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                <div className="h-8 w-8 rounded-xl bg-primary/5 border border-primary/5 flex items-center justify-center shrink-0">
                  <Link2 className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-foreground mb-0.5">Active Application Link</p>
                  <code className="text-sm font-mono text-foreground bg-white/50 px-3 py-1 rounded-lg border border-border/40 truncate block">
                    {typeof window !== "undefined"
                      ? `${window.location.origin}${session.link}`
                      : session.link}
                  </code>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 shrink-0 rounded-lg border-border/60 h-8"
                onClick={handleCopyLink}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "Copied" : "Copy Link"}
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Bias Results */}
      {biasResult && biasResult.has_bias && (
        <motion.div variants={itemVariants}>
          <Alert variant="warning" className="rounded-2xl border-amber-200 bg-amber-50/50 backdrop-blur-sm">
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-3">
                <p className="text-sm font-semibold text-amber-800">{biasResult.issues.length} bias issue(s) found</p>
                {biasResult.issues.map((issue, i) => (
                  <div key={i} className="text-xs space-y-0.5 bg-white/50 rounded-lg p-3 border border-amber-100">
                    <span className="font-semibold text-amber-700">[{issue.category}]</span>
                    <p className="text-amber-800/80">&ldquo;{issue.text}&rdquo;</p>
                    <p className="text-success mt-1">→ {issue.suggestion}</p>
                  </div>
                ))}
                {biasResult.suggestions.length > 0 && (
                  <div className="bg-white/50 rounded-lg p-3 border border-amber-100">
                    <p className="text-xs font-semibold text-amber-700 mb-2">Suggestions:</p>
                    {biasResult.suggestions.map((s, i) => (
                      <p key={i} className="text-xs text-amber-800/80">• {s}</p>
                    ))}
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      {biasResult && !biasResult.has_bias && (
        <motion.div variants={itemVariants}>
          <Alert variant="success" className="rounded-2xl border-success bg-green-50/50 backdrop-blur-sm">
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription className="text-sm font-medium text-success">
              No bias detected — JD looks great!
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* Pipeline Overview */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">Pipeline Overview</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Track your hiring progress at a glance</p>
          </div>
          <Link href={ROUTES.candidates} className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card, i) => (
            <motion.div
              key={card.label}
              variants={itemVariants}
              transition={{ delay: i * 0.03 }}
            >
              <Link href={card.href} className="block group">
                <div className="glass-card rounded-2xl p-5 border border-white/50 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
                    <div className={`h-8 w-8 rounded-xl ${card.bgLight} flex items-center justify-center`}>
                      <card.icon className="h-4 w-4" style={{
                        color: card.gradient.includes('primary') ? 'var(--primary)' :
                               card.gradient.includes('blue') ? 'var(--info)' :
                               card.gradient.includes('amber') ? 'var(--warning)' :
                               'var(--success)'
                      }} />
                    </div>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                    {getStatValue(stats, card)}
                  </p>
                  {card.trend && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <TrendingUp className="h-3 w-3 text-primary" />
                      <span className="text-[10px] font-medium text-primary">{card.trend}</span>
                    </div>
                  )}
                  {card.sub && (
                    <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">
                      {card.sub(stats)}
                    </p>
                  )}
                  {!card.trend && !card.sub && (
                    <div className="mt-3" />
                  )}
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Candidates Section */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">Recent Candidates</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {candidates.length > 0
                ? `Showing ${candidates.length} recent candidate${candidates.length === 1 ? '' : 's'}`
                : "No candidates uploaded yet"}
            </p>
          </div>
          {candidates.length > 0 && (
            <Link href={`${ROUTES.candidates}?session=${session?.sessionId}`}>
              <Button variant="ghost" size="sm" className="rounded-lg text-xs h-8 text-muted-foreground hover:text-foreground">
                View All
                <ArrowUpRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          )}
        </div>

        <div className="glass-card rounded-2xl border border-white/50 overflow-hidden">
          {isValidating && !candidates.length ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-48 rounded-md" />
                    <Skeleton className="h-2.5 w-32 rounded-md" />
                  </div>
                  <Skeleton className="h-4 w-20 rounded-md" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-8 w-16 rounded-lg" />
                </div>
              ))}
            </div>
          ) : candidates.length === 0 ? (
            <div className="p-12 md:p-16">
              <div className="flex flex-col items-center text-center max-w-sm mx-auto">
                <div className="h-16 w-16 rounded-2xl bg-primary/5 border border-primary/5 flex items-center justify-center mb-5">
                  <Users className="h-7 w-7 text-primary/40" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1.5">No candidates yet</h3>
                <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                  Upload a resume or create an application link above to start receiving candidates.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 w-full">
                  <Button
                    size="sm"
                    onClick={() => {
                      const el = document.querySelector('textarea')
                      if (el) el.focus()
                    }}
                    className="rounded-xl bg-primary text-white shadow-md shadow-primary/20 transition-all"
                  >
                    <FilePlus className="h-4 w-4 mr-1.5" />
                    Paste Job Description
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNewSession}
                    className="rounded-xl border-border/60"
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Create Session
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-white/30 border-b border-border/40">
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-3">Candidate</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-3">Match Score</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-3">Flight Risk</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-3">Status</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-3">Resume</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-3 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.map((candidate) => (
                    <CandidateTableRow
                      key={candidate.id}
                      candidate={candidate}
                      onSelect={handleSelectCandidate}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </motion.div>

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
