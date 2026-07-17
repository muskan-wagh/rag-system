"use client"

import { useState, useCallback, useEffect, useRef, memo } from "react"
import Link from "next/link"

import {
  Sparkles, Link2, RefreshCw, Loader2, ShieldAlert, Plus,
  FilePlus, Copy, Check, Users, FileText,
  FolderOpen, Calendar, BadgeCheck, XCircle, LayoutDashboard,
  Search,
} from "lucide-react"
import { toast } from "sonner"
import { CandidateDetailModal } from "@/components/candidate-detail-modal"
import { useApi } from "@/hooks/use-api"
import { useWebSocket } from "@/lib/use-websocket"
import { ROUTES, getStatusColor, getInitials, getFlightRiskColor, CANDIDATE_STATUS } from "@/lib/constants"
import type { SessionStats } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { PageHeader } from "@/components/ui/page-header"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"

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

const CandidateTableRow = memo(function CandidateTableRow({
  candidate,
  onSelect,
}: {
  candidate: CandidateRow
  onSelect: (c: CandidateRow) => void
}) {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">
              {getInitials(candidate.full_name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-sm">{candidate.full_name || "Unknown"}</p>
            <p className="text-xs text-muted-foreground">
              {candidate.current_title || ""}
              {candidate.current_title && candidate.current_company ? " @ " : ""}
              {candidate.current_company || ""}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        {candidate.match_score !== undefined ? (
          <div className="flex items-center gap-2">
            <Progress value={Math.round(candidate.match_score)} className="h-1.5 w-16" />
            <span className="text-xs font-mono">{Math.round(candidate.match_score)}%</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={getFlightRiskColor(candidate.flight_risk)} className="capitalize">
          {candidate.flight_risk || "Unknown"}
        </Badge>
      </TableCell>
      <TableCell>
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(candidate.current_status || candidate.status)}`}>
          {candidate.current_status || candidate.status || CANDIDATE_STATUS.APPLIED}
        </span>
      </TableCell>
      <TableCell>
        {candidate.resume_file_url ? (
          <a
            href={candidate.resume_file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors hover:bg-muted hover:text-foreground text-muted-foreground"
          >
            <FileText className="h-3.5 w-3.5" />
            View
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="sm" onClick={() => onSelect(candidate)}>
          View
        </Button>
      </TableCell>
    </TableRow>
  )
})

export default function DashboardPage() {
  const [jdText, setJdText] = useState("")
  const [session, setSession] = useState<SessionData | null>(null)
  const [generating, setGenerating] = useState(false)
  const [candidates, setCandidates] = useState<CandidateRow[]>([])
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateRow | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [error, setError] = useState("")
  const [initialLoading, setInitialLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const [scanningBias, setScanningBias] = useState(false)
  const [biasResult, setBiasResult] = useState<{ has_bias: boolean; issues: BiasIssue[]; suggestions: string[] } | null>(null)
  const [biasError, setBiasError] = useState("")

  const [stats, setStats] = useState<SessionStats | null>(null)
  const [page] = useState(1)

  const wsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const api = useApi()

  const loadDashboard = useCallback(async (p?: number) => {
    const pageNum = p ?? page
    setLoadingCandidates(true)
    try {
      const res = await api.getDashboard(pageNum, 50)
      if (res.success && res.data) {
        const { stats: s, recentUploads, sessions: sessList } = res.data
        const latestSession = sessList?.[0]
        if (latestSession) {
          setSession({ sessionId: latestSession.id, link: `/upload/${latestSession.id}` })
          setJdText(latestSession.job_description_text)
        } else {
          setSession(null)
        }
        setCandidates(recentUploads ?? [])
        setStats(s)
      }
    } catch {
      setSession(null)
    } finally {
      setLoadingCandidates(false)
      setInitialLoading(false)
    }
  }, [page])

  useWebSocket('candidate:status_changed', useCallback((payload) => {
    const sid = payload.sessionId as string || session?.sessionId
    if (sid && session?.sessionId === sid) {
      if (wsDebounceRef.current) clearTimeout(wsDebounceRef.current)
      wsDebounceRef.current = setTimeout(() => loadDashboard(), 500)
    }
  }, [session?.sessionId, loadDashboard]))

  const initialLoadRef = useRef(false)

  useEffect(() => {
    if (initialLoadRef.current) return
    initialLoadRef.current = true
    loadDashboard(1)
    return () => {
      if (wsDebounceRef.current) clearTimeout(wsDebounceRef.current)
    }
  }, [loadDashboard])

  const generateLink = useCallback(async () => {
    if (!jdText.trim()) return
    setGenerating(true)
    setError("")

    try {
      const res = await api.generateLink(jdText)
      if (res.success && res.data) {
        const { sessionId, link } = res.data
        setSession({ sessionId, link })
        loadDashboard()
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
  }, [jdText, loadDashboard])

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
  }, [jdText])

  const handleNewSession = () => {
    setSession(null)
    setCandidates([])
    setJdText("")
    setBiasResult(null)
    setError("")
    setInitialLoading(false)
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

  if (initialLoading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title="Dashboard"
        description="Manage your hiring pipeline"
        actions={
          <div className="flex items-center gap-2">
            {session && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => loadDashboard()}
                disabled={loadingCandidates}
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loadingCandidates ? "animate-spin" : ""}`} />
                Refresh
                {candidates.length > 0 && (
                  <span className="ml-1 rounded-full bg-primary/5 px-1.5 py-0.5 text-[10px] text-primary">
                    {candidates.length}
                  </span>
                )}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleNewSession}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              {session ? "New Session" : "Create Session"}
            </Button>
          </div>
        }
      />

      <Card className="p-5">
        <div className="space-y-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <FilePlus className="h-4 w-4 text-primary" />
            Create New Application Link
          </h2>

          <Textarea
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            placeholder="Paste the full job description here. The AI will parse this to match candidates."
            rows={5}
          />

          {error && (
            <Alert variant="destructive">
              <AlertDescription className="flex items-center justify-between">
                <span>{error}</span>
                <Button variant="ghost" size="xs" onClick={() => { setError(""); generateLink() }}>
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {biasError && (
            <Alert variant="destructive">
              <AlertDescription className="flex items-center justify-between">
                <span>{biasError}</span>
                <Button variant="ghost" size="xs" onClick={handleBiasScan}>
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {jdText.length} / 5000 characters
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBiasScan}
                disabled={scanningBias || !jdText.trim()}
              >
                {scanningBias ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <ShieldAlert className="h-3.5 w-3.5 mr-1" />
                )}
                {scanningBias ? "Scanning..." : "Check for Bias"}
              </Button>
              <Button
                size="sm"
                onClick={generateLink}
                disabled={generating || !jdText.trim()}
              >
                {generating ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                )}
                {generating ? "Generating..." : "Generate Application Link"}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {biasResult && biasResult.has_bias && (
        <Alert variant="warning">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">{biasResult.issues.length} bias issue(s) found</p>
              {biasResult.issues.map((issue, i) => (
                <div key={i} className="text-xs space-y-0.5">
                  <span className="font-medium">[{issue.category}]</span> &ldquo;{issue.text}&rdquo;
                  <p className="text-warning">→ {issue.suggestion}</p>
                </div>
              ))}
              {biasResult.suggestions.length > 0 && (
                <div className="pt-2 border-t border-amber-200">
                  <p className="text-xs font-medium mb-1">Suggestions:</p>
                  {biasResult.suggestions.map((s, i) => (
                    <p key={i} className="text-xs">• {s}</p>
                  ))}
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {biasResult && !biasResult.has_bias && (
        <Alert variant="success">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>No bias detected — JD looks great!</AlertDescription>
        </Alert>
      )}

      {session && (
        <Card className="border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Link2 className="h-4 w-4 text-primary shrink-0" />
              <span className="font-medium text-sm shrink-0">Active Link:</span>
              <code className="text-sm bg-white px-3 py-1 rounded border font-mono truncate">
                {typeof window !== "undefined"
                  ? `${window.location.origin}${session.link}`
                  : session.link}
              </code>
            </div>
            <Button variant="outline" size="sm" className="gap-1 shrink-0" onClick={handleCopyLink}>
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </Card>
      )}

      <div>
        <h2 className="text-sm font-semibold mb-3">Pipeline Overview</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href={ROUTES.candidates} className="block group">
            <Card className="p-4 cursor-pointer hover:shadow-sm transition-shadow border-t-2 border-t-primary">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground">Total Candidates</p>
                <div className="p-1.5 rounded-md bg-primary/10">
                  <Users className="h-4 w-4 text-primary" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">{stats?.totalCandidates ?? 0}</p>
            </Card>
          </Link>
          <Link href={ROUTES.candidates} className="block group">
            <Card className="p-4 cursor-pointer hover:shadow-sm transition-shadow border-t-2 border-t-accent">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground">Uploaded Today</p>
                <div className="p-1.5 rounded-md bg-accent/10">
                  <FilePlus className="h-4 w-4 text-accent" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">{stats?.uploadedToday ?? 0}</p>
            </Card>
          </Link>
          <Link href={ROUTES.candidates} className="block group">
            <Card className="p-4 cursor-pointer hover:shadow-sm transition-shadow border-t-2 border-t-success">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground">Open</p>
                <div className="p-1.5 rounded-md bg-success/10">
                  <FolderOpen className="h-4 w-4 text-success" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">{stats?.open ?? 0}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{stats?.applied ?? 0} Applied | {stats?.screening ?? 0} Screening</p>
            </Card>
          </Link>
          <Link href={ROUTES.interview} className="block group">
            <Card className="p-4 cursor-pointer hover:shadow-sm transition-shadow border-t-2 border-t-primary/60">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground">Interview</p>
                <div className="p-1.5 rounded-md bg-primary/10">
                  <Calendar className="h-4 w-4 text-primary" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">{stats?.interview ?? 0}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{stats?.interviewsToday ?? 0} Today</p>
            </Card>
          </Link>
          <Link href={`${ROUTES.candidates}?status=hired,offer`} className="block group">
            <Card className="p-4 cursor-pointer hover:shadow-sm transition-shadow border-t-2 border-t-success/80">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground">Hired</p>
                <div className="p-1.5 rounded-md bg-success/10">
                  <BadgeCheck className="h-4 w-4 text-success" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {(stats?.hired ?? 0) + (stats?.offered ?? 0)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {stats?.hired ?? 0} Hired | {stats?.offered ?? 0} Pending
              </p>
            </Card>
          </Link>
          <Link href={`${ROUTES.candidates}?status=rejected`} className="block group">
            <Card className="p-4 cursor-pointer hover:shadow-sm transition-shadow border-t-2 border-t-destructive">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground">Rejected</p>
                <div className="p-1.5 rounded-md bg-destructive/10">
                  <XCircle className="h-4 w-4 text-destructive" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">{stats?.rejected ?? 0}</p>
            </Card>
          </Link>
          <Link href={ROUTES.candidateSearch} className="block group">
            <Card className="p-4 cursor-pointer hover:shadow-sm transition-shadow border-t-2 border-t-muted-foreground/40">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground">Searches</p>
                <div className="p-1.5 rounded-md bg-muted">
                  <Search className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">{stats?.searches ?? 0}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{stats?.activeSessions ?? 0} Active Sessions</p>
            </Card>
          </Link>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b bg-muted/30">
          <h3 className="font-semibold text-sm">
            Candidates
            {candidates.length > 0 && (
              <span className="ml-1.5 text-muted-foreground font-normal">
                ({candidates.length})
              </span>
            )}
          </h3>
          <Link href={`${ROUTES.candidates}?session=${session?.sessionId}`}>
            <Button variant="ghost" size="sm">View All</Button>
          </Link>
        </div>

        {loadingCandidates ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-2 w-24" />
                </div>
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>
        ) : candidates.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No candidates yet"
            description="Upload a resume or share an application link to get started."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Match Score</TableHead>
                  <TableHead>Flight Risk</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Resume</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
      </Card>

      <CandidateDetailModal
        open={showDetailModal}
        onClose={() => {
          setShowDetailModal(false)
          setSelectedCandidate(null)
        }}
        candidate={selectedCandidate}
        onStatusChange={() => loadDashboard()}
      />
    </div>
  )
}
