"use client"

import { useState, useCallback, useEffect, useRef, memo } from "react"
import { motion } from "framer-motion"
import Link from "next/link"

import {
  Sparkles, Link2, RefreshCw, Loader2, ShieldAlert, Plus,
  FilePlus, Copy, Check, Users, FileText,
  FolderOpen, Calendar, BadgeCheck, XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { CandidateDetailModal } from "@/components/candidate-detail-modal"
import { apiFetch } from "@/lib/api-fetch"
import { scanBias, getDashboard } from "@/lib/api"
import { useWebSocket } from "@/lib/use-websocket"
import { ROUTES, getStatusColor } from "@/lib/constants"
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
              {getInitials(candidate.full_name || "?")}
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
        <Badge variant={getFlightRiskVariant(candidate.flight_risk)} className="capitalize">
          {candidate.flight_risk || "Unknown"}
        </Badge>
      </TableCell>
      <TableCell>
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(candidate.current_status || candidate.status)}`}>
          {candidate.current_status || candidate.status || "Applied"}
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
  const [page, setPage] = useState(1)

  const wsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadDashboard = useCallback(async (p?: number) => {
    const pageNum = p ?? page
    setLoadingCandidates(true)
    try {
      const res = await getDashboard(pageNum, 50)
      if (res.success && res.data) {
        const { session: sess, candidates: cands, stats: s } = res.data
        if (sess) {
          setSession({ sessionId: sess.id, link: sess.link })
          setJdText(sess.job_description_text)
        }
        setCandidates(cands)
        setStats(s)
      }
    } catch {
      setSession(null)
    } finally {
      setLoadingCandidates(false)
      setInitialLoading(false)
    }
  }, [page])

  // Debounced WebSocket handler: coalesces rapid status changes into a single refetch
  useWebSocket('candidate:status_changed', useCallback((payload) => {
    const sid = payload.sessionId as string || session?.sessionId
    if (sid && session?.sessionId === sid) {
      if (wsDebounceRef.current) clearTimeout(wsDebounceRef.current)
      wsDebounceRef.current = setTimeout(() => loadDashboard(), 500)
    }
  }, [session?.sessionId, loadDashboard]))

  useEffect(() => {
    async function init() {
      await loadDashboard(1)
    }
    init()
    return () => {
      if (wsDebounceRef.current) clearTimeout(wsDebounceRef.current)
    }
  }, [])

  const generateLink = useCallback(async () => {
    if (!jdText.trim()) return
    setGenerating(true)
    setError("")

    try {
      const res = await apiFetch(`/api/generate-link`, {
        method: "POST",
        body: JSON.stringify({ jdText }),
      })

      if (!res.ok) {
        if (res.status === 401) throw new Error("auth")
        throw new Error(`HTTP ${res.status}`)
      }

      const data = await res.json()
      if (data.success) {
        const sessionData = data.data
        setSession(sessionData)
        loadDashboard()
        toast.success("Application link generated!")
      } else {
        setError(data.error || "Failed to generate link")
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
      const result = await scanBias(jdText)
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
      <div className="max-w-7xl mx-auto p-6 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-sm border-b">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-foreground">RecruitIQ</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-muted-foreground">Dashboard</span>
            </div>
            <div className="flex items-center gap-2">
              {session && (
                <>
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
                  <Button variant="ghost" size="sm" onClick={handleNewSession}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    New Session
                  </Button>
                </>
              )}
              {!session && (
                <Button variant="ghost" size="sm" onClick={handleNewSession}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  New Session
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8">
        {/* Generate Application Link Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="p-6">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FilePlus className="h-5 w-5 text-primary" />
                Create New Application Link
              </h2>

              <Textarea
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                placeholder="Paste the full job description here. The AI will parse this to match candidates."
                rows={6}
              />

              {error && (
                <Alert variant="destructive">
                  <AlertDescription className="flex items-center justify-between">
                    <span>{error}</span>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => { setError(""); generateLink() }}
                    >
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
        </motion.div>

        {biasResult && biasResult.has_bias && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Alert variant="warning">
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">{biasResult.issues.length} bias issue(s) found</p>
                  {biasResult.issues.map((issue, i) => (
                    <div key={i} className="text-xs space-y-0.5">
                      <span className="font-medium">[{issue.category}]</span> &ldquo;{issue.text}&rdquo;
                      <p className="text-amber-600">→ {issue.suggestion}</p>
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
          </motion.div>
        )}

        {biasResult && !biasResult.has_bias && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Alert variant="success">
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription>No bias detected — JD looks great!</AlertDescription>
            </Alert>
          </motion.div>
        )}

        {session && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
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
          </motion.div>
        )}

        {session && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold">Pipeline Overview</h2>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Link href={ROUTES.candidates} className="block group">
                <Card className="p-5 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all duration-200 border-t-4 border-t-blue-500">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-muted-foreground">Open Candidates</p>
                    <div className="p-2 rounded-lg bg-blue-50">
                      <FolderOpen className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-blue-600">{stats?.applied ?? 0}</p>
                  <p className="text-xs text-blue-500 mt-2 group-hover:underline">View All &rarr;</p>
                </Card>
              </Link>
              <Link href={ROUTES.interview} className="block group">
                <Card className="p-5 cursor-pointer hover:shadow-md hover:border-purple-300 transition-all duration-200 border-t-4 border-t-purple-500">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-muted-foreground">Interview</p>
                    <div className="p-2 rounded-lg bg-purple-50">
                      <Calendar className="h-5 w-5 text-purple-600" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-purple-600">{stats?.interview ?? 0}</p>
                  <p className="text-xs text-purple-500 mt-2 group-hover:underline">Manage &rarr;</p>
                </Card>
              </Link>
              <Link href={`${ROUTES.candidates}?status=hired,offer`} className="block group">
                <Card className="p-5 cursor-pointer hover:shadow-md hover:border-green-300 transition-all duration-200 border-t-4 border-t-green-500">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-muted-foreground">Hired</p>
                    <div className="p-2 rounded-lg bg-green-50">
                      <BadgeCheck className="h-5 w-5 text-green-600" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-green-600">
                    {(stats?.hired ?? 0) + (stats?.offered ?? 0)}
                  </p>
                  <p className="text-xs text-green-600 mt-2">
                    {stats?.hired ?? 0} Hired | {stats?.offered ?? 0} Pending
                  </p>
                </Card>
              </Link>
              <Link href={`${ROUTES.candidates}?status=rejected`} className="block group">
                <Card className="p-5 cursor-pointer hover:shadow-md hover:border-red-300 transition-all duration-200 border-t-4 border-t-red-500">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-muted-foreground">Rejected</p>
                    <div className="p-2 rounded-lg bg-red-50">
                      <XCircle className="h-5 w-5 text-red-600" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-red-600">{stats?.rejected ?? 0}</p>
                  <p className="text-xs text-red-500 mt-2 group-hover:underline">View &rarr;</p>
                </Card>
              </Link>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-0 overflow-hidden border shadow-sm">
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
                description="Share your application link to start receiving resumes."
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
        </motion.div>
      </div>

      <CandidateDetailModal
        open={showDetailModal}
        onClose={() => {
          setShowDetailModal(false)
          setSelectedCandidate(null)
        }}
        candidate={selectedCandidate}
        onStatusChange={() => loadDashboard()}
      />
    </>
  )
}
