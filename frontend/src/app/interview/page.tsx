"use client"

import { useState, useCallback, useEffect, startTransition } from "react"
import { motion } from "framer-motion"
import {
  Calendar, Loader2, Mail, BadgeCheck, XCircle, Users, Clock, ArrowUpRight,
} from "lucide-react"
import { toast } from "sonner"
import { useApi } from "@/hooks/use-api"
import { useWebSocket } from "@/lib/use-websocket"
import { getInitials, formatDate, CANDIDATE_STATUS } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { SearchInput } from "@/components/ui/search-input"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table"
import { ScheduleInterviewModal } from "@/components/schedule-interview-modal"
import { EmailCandidateModal } from "@/components/email-candidate-modal"
import { RejectModal } from "@/components/reject-modal"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import type { CandidateRecord } from "@/lib/api"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const } },
}

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
        limit: 100, sortBy: "created_at", sortOrder: "desc",
        status: CANDIDATE_STATUS.INTERVIEW_SCHEDULED,
      })
      if (res.success && res.data) {
        const data = res.data as { candidates: CandidateRecord[] }
        startTransition(() => setCandidates(data.candidates))
      }
    } catch {
      toast.error("Failed to load interview candidates")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadCandidates() }, [loadCandidates])
  useWebSocket("candidate:status_changed", loadCandidates)

  const filteredCandidates = candidates.filter((c) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (c.full_name || "").toLowerCase().includes(q) ||
      (c.current_company || "").toLowerCase().includes(q) ||
      (c.current_title || "").toLowerCase().includes(q)
  })

  const handleSchedule = (candidate: CandidateRecord) => { setSelectedCandidate(candidate); setShowScheduleModal(true) }
  const handleEmail = (candidate: CandidateRecord) => { setSelectedCandidate(candidate); setShowEmailModal(true) }
  const handleOffer = (candidate: CandidateRecord) => { setSelectedCandidate(candidate); setShowOfferConfirm(true) }

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

  const handleReject = (candidate: CandidateRecord) => { setSelectedCandidate(candidate); setShowRejectModal(true) }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="pt-6 space-y-8"
    >
      <motion.div variants={itemVariants} className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-medium text-[#111111] tracking-tight">Interviews</h1>
          <p className="text-sm text-[#6B7280] mt-1">Manage your interview pipeline</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-[#ECECEC]">
          <div className="text-center">
            <p className="text-sm font-medium text-[#111111] tabular-nums">{filteredCandidates.length}</p>
            <p className="text-[10px] text-[#A3A3A3]">Candidates</p>
          </div>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="flex items-center gap-3">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by name, company, or position..."
        />
      </motion.div>

      <motion.div variants={itemVariants} className="bg-white rounded-[24px] border border-[#ECECEC] shadow-[0_10px_40px_rgba(0,0,0,0.05)] overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-2 w-24" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-8 w-28" />
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
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="text-xs bg-[#F6F6F4] text-[#6B7280]">
                            {getInitials(candidate.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium text-[#111111]">{candidate.full_name || "Unknown"}</p>
                          <Badge variant="warning" className="mt-0.5">
                            {candidate.current_status || "Interview"}
                          </Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-[#6B7280]">{candidate.current_company || "—"}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-[#6B7280]">{candidate.current_title || "—"}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-xs text-[#A3A3A3]">{formatDate(candidate.created_at)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleSchedule(candidate)} className="h-8 px-2.5 text-xs">
                          <Calendar className="h-3.5 w-3.5 mr-1" strokeWidth={1.5} />
                          Schedule
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEmail(candidate)} className="h-8 px-2.5 text-xs">
                          <Mail className="h-3.5 w-3.5 mr-1" strokeWidth={1.5} />
                          Email
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleOffer(candidate)} className="h-8 px-2.5 text-xs text-[#16A34A] hover:text-[#16A34A] hover:bg-[#16A34A]/10">
                          <BadgeCheck className="h-3.5 w-3.5 mr-1" strokeWidth={1.5} />
                          Offer
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleReject(candidate)} className="h-8 px-2.5 text-xs text-[#EF4444] hover:text-[#EF4444] hover:bg-[#EF4444]/10">
                          <XCircle className="h-3.5 w-3.5 mr-1" strokeWidth={1.5} />
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
      </motion.div>

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
            <div className="flex items-center gap-2 text-[#16A34A] mb-3">
              <BadgeCheck className="h-5 w-5" />
              <h2 className="text-base font-medium text-[#111111]">Move to Offer</h2>
            </div>
            <p className="text-sm text-[#6B7280]">
              This will move <strong className="text-[#111111]">{selectedCandidate?.full_name || "the candidate"}</strong> to Offer (Pending Hire).
            </p>
          </div>
          <div className="px-6 pb-6 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setShowOfferConfirm(false); setSelectedCandidate(null) }} disabled={offerLoading}>
              Cancel
            </Button>
            <Button size="sm" className="bg-[#111111] text-white hover:bg-[#2A2A2A]" onClick={confirmOffer} disabled={offerLoading}>
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
    </motion.div>
  )
}
