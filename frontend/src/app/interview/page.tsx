"use client"

import { useState, useCallback, useEffect, startTransition } from "react"
import Link from "next/link"
import {
  Calendar, Loader2, Search, Mail,
  BadgeCheck, XCircle, ArrowLeft, LayoutDashboard,
} from "lucide-react"
import { toast } from "sonner"
import { getAllCandidates, updateCandidateStatus } from "@/lib/api"
import { useWebSocket } from "@/lib/use-websocket"
import { ROUTES, getStatusColor } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import { ScheduleInterviewModal } from "@/components/schedule-interview-modal"
import { EmailCandidateModal } from "@/components/email-candidate-modal"
import { RejectModal } from "@/components/reject-modal"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import type { CandidateRecord } from "@/lib/api"

function getInitials(name?: string): string {
  return (name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—"
  try {
    return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
  } catch {
    return dateStr
  }
}

export default function InterviewPage() {
  const [candidates, setCandidates] = useState<CandidateRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  const [selectedCandidate, setSelectedCandidate] = useState<CandidateRecord | null>(null)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showOfferConfirm, setShowOfferConfirm] = useState(false)
  const [offerLoading, setOfferLoading] = useState(false)

  const loadCandidates = useCallback(async () => {
    try {
      const res = await getAllCandidates({
        limit: 100,
        sortBy: "created_at",
        sortOrder: "desc",
        status: "interview",
      })
      if (res.success && res.data) {
        const data = res.data
        startTransition(() => {
          setCandidates(data.candidates)
        })
      }
    } catch {
      toast.error("Failed to load interview candidates")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCandidates()
  }, [loadCandidates])

  useWebSocket("candidate:status_changed", loadCandidates)

  const filteredCandidates = candidates.filter((c) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      (c.full_name || "").toLowerCase().includes(q) ||
      (c.current_company || "").toLowerCase().includes(q) ||
      (c.current_title || "").toLowerCase().includes(q)
    )
  })

  const handleSchedule = (candidate: CandidateRecord) => {
    setSelectedCandidate(candidate)
    setShowScheduleModal(true)
  }

  const handleEmail = (candidate: CandidateRecord) => {
    setSelectedCandidate(candidate)
    setShowEmailModal(true)
  }

  const handleOffer = (candidate: CandidateRecord) => {
    setSelectedCandidate(candidate)
    setShowOfferConfirm(true)
  }

  const confirmOffer = async () => {
    if (!selectedCandidate) return
    setOfferLoading(true)
    try {
      const res = await updateCandidateStatus(selectedCandidate.id, "Offer")
      if (res.success) {
        toast.success("Candidate moved to Offer (Pending Hire)")
        setShowOfferConfirm(false)
        setSelectedCandidate(null)
        loadCandidates()
      } else {
        toast.error(res.error || "Failed to move candidate to Offer")
      }
    } catch {
      toast.error("Failed to move candidate to Offer")
    } finally {
      setOfferLoading(false)
    }
  }

  const handleReject = (candidate: CandidateRecord) => {
    setSelectedCandidate(candidate)
    setShowRejectModal(true)
  }

  return (
    <>
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-sm border-b">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2 text-sm">
              <Link href={ROUTES.dashboard} className="text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="h-4 w-4 inline mr-1" />
              </Link>
              <span className="font-semibold text-foreground">RecruitIQ</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-muted-foreground">Interview</span>
            </div>
            <Link href={ROUTES.dashboard}>
              <Button variant="ghost" size="sm">
                <LayoutDashboard className="h-3.5 w-3.5 mr-1" />
                Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-purple-600" />
            Interview Candidates
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage candidates selected for interviews
          </p>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, company, or position..."
              className="w-full h-9 pl-9 pr-4 text-sm rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
          {filteredCandidates.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {filteredCandidates.length} candidate{filteredCandidates.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Candidates Table */}
        <Card className="p-0 overflow-hidden border shadow-sm">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-2 w-24" />
                  </div>
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          ) : filteredCandidates.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No interview candidates"
              description={searchQuery ? "Try a different search term" : "Candidates moved to Interview stage will appear here."}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead className="hidden md:table-cell">Applied</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCandidates.map((candidate) => (
                    <TableRow key={candidate.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {getInitials(candidate.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate max-w-[180px]">
                              {candidate.full_name || "Unknown"}
                            </p>
                            <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${getStatusColor(candidate.current_status)}`}>
                              {candidate.current_status || "Interview"}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {candidate.current_company || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {candidate.current_title || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(candidate.created_at)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSchedule(candidate)}
                            className="h-8 px-2 text-xs"
                            title="Schedule Interview"
                          >
                            <Calendar className="h-3.5 w-3.5 mr-1" />
                            Schedule
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEmail(candidate)}
                            className="h-8 px-2 text-xs"
                            title="Send Email"
                          >
                            <Mail className="h-3.5 w-3.5 mr-1" />
                            Email
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOffer(candidate)}
                            className="h-8 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                            title="Move to Offer"
                          >
                            <BadgeCheck className="h-3.5 w-3.5 mr-1" />
                            Offer
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReject(candidate)}
                            className="h-8 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Reject"
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      {/* Schedule Interview Modal */}
      {selectedCandidate && (
        <ScheduleInterviewModal
          open={showScheduleModal}
          onClose={() => { setShowScheduleModal(false); setSelectedCandidate(null) }}
          candidateId={selectedCandidate.id}
          onSuccess={() => { setShowScheduleModal(false); setSelectedCandidate(null); loadCandidates() }}
        />
      )}

      {/* Email Candidate Modal */}
      {selectedCandidate && (
        <EmailCandidateModal
          open={showEmailModal}
          onClose={() => { setShowEmailModal(false); setSelectedCandidate(null) }}
          candidateId={selectedCandidate.id}
          candidateName={selectedCandidate.full_name || "Candidate"}
          onSuccess={() => { setShowEmailModal(false); setSelectedCandidate(null) }}
        />
      )}

      {/* Offer Confirmation Dialog */}
      <Dialog open={showOfferConfirm} onOpenChange={(o) => { if (!o) { setShowOfferConfirm(false); setSelectedCandidate(null) } }}>
        <DialogContent className="sm:max-w-md">
          <div className="px-6 pt-6 pb-2">
            <div className="flex items-center gap-2 text-green-600">
              <BadgeCheck className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Move to Offer</h2>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              This will move <strong>{selectedCandidate?.full_name || "the candidate"}</strong> to Offer (Pending Hire).
              They will appear in the Hired block under &ldquo;Pending&rdquo; until confirmed.
            </p>
          </div>
          <div className="px-6 pb-6 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setShowOfferConfirm(false); setSelectedCandidate(null) }} disabled={offerLoading}>
              Cancel
            </Button>
            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={confirmOffer} disabled={offerLoading}>
              {offerLoading && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Confirm Offer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      {selectedCandidate && (
        <RejectModal
          open={showRejectModal}
          onClose={() => { setShowRejectModal(false); setSelectedCandidate(null) }}
          candidateId={selectedCandidate.id}
          onSuccess={() => { setShowRejectModal(false); setSelectedCandidate(null); loadCandidates() }}
        />
      )}
    </>
  )
}
