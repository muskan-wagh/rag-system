"use client"

import { useState, useCallback, useEffect, startTransition } from "react"
import {
  Calendar, Loader2, Mail,
  BadgeCheck, XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { useApi } from "@/hooks/use-api"
import { useWebSocket } from "@/lib/use-websocket"
import { getStatusColor, getInitials, formatDate, CANDIDATE_STATUS } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { PageHeader } from "@/components/ui/page-header"
import { SearchInput } from "@/components/ui/search-input"
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

export default function InterviewPage() {
  const [candidates, setCandidates] = useState<CandidateRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const api = useApi()

  const [selectedCandidate, setSelectedCandidate] = useState<CandidateRecord | null>(null)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showOfferConfirm, setShowOfferConfirm] = useState(false)
  const [offerLoading, setOfferLoading] = useState(false)

  const loadCandidates = useCallback(async () => {
    try {
      const res = await api.getAllCandidates({
        limit: 100,
        sortBy: "created_at",
        sortOrder: "desc",
        status: CANDIDATE_STATUS.INTERVIEW_SCHEDULED,
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
      const res = await api.updateCandidateStatus(selectedCandidate.id, CANDIDATE_STATUS.OFFERED)
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
    <div className="p-6 lg:p-8 space-y-6">
      <PageHeader
        icon={Calendar}
        title="Interview Candidates"
        description="Manage candidates selected for interviews"
      />

      <div className="flex items-center gap-3">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by name, company, or position..."
        />
        {filteredCandidates.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {filteredCandidates.length} candidate{filteredCandidates.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <Card className="p-0 overflow-hidden">
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
                        <Button variant="ghost" size="sm" onClick={() => handleSchedule(candidate)} className="h-8 px-2 text-xs" title="Schedule Interview">
                          <Calendar className="h-3.5 w-3.5 mr-1" />
                          Schedule
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEmail(candidate)} className="h-8 px-2 text-xs" title="Send Email">
                          <Mail className="h-3.5 w-3.5 mr-1" />
                          Email
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleOffer(candidate)} className="h-8 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50" title="Move to Offer">
                          <BadgeCheck className="h-3.5 w-3.5 mr-1" />
                          Offer
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleReject(candidate)} className="h-8 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50" title="Reject">
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

      {selectedCandidate && (
        <ScheduleInterviewModal
          open={showScheduleModal}
          onClose={() => { setShowScheduleModal(false); setSelectedCandidate(null) }}
          candidateId={selectedCandidate.id}
          onSuccess={() => { setShowScheduleModal(false); setSelectedCandidate(null); loadCandidates() }}
        />
      )}

      {selectedCandidate && (
        <EmailCandidateModal
          open={showEmailModal}
          onClose={() => { setShowEmailModal(false); setSelectedCandidate(null) }}
          candidateId={selectedCandidate.id}
          candidateName={selectedCandidate.full_name || "Candidate"}
          onSuccess={() => { setShowEmailModal(false); setSelectedCandidate(null) }}
        />
      )}

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

      {selectedCandidate && (
        <RejectModal
          open={showRejectModal}
          onClose={() => { setShowRejectModal(false); setSelectedCandidate(null) }}
          candidateId={selectedCandidate.id}
          onSuccess={() => { setShowRejectModal(false); setSelectedCandidate(null); loadCandidates() }}
        />
      )}
    </div>
  )
}
