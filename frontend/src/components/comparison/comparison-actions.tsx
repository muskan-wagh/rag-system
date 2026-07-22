"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { CalendarPlus, UserPlus, Mail, Archive, XCircle } from "lucide-react"
import type { ComparisonCandidate } from "@/lib/api"

interface ComparisonActionsProps {
  candidates: ComparisonCandidate[]
  onScheduleInterview: (candidateId: string, name: string) => void
  onAddToPool: (candidateId: string, name: string) => void
  onEmail: (candidateId: string, name: string) => void
  onShortlist: (candidateId: string, name: string) => void
  onReject: (candidateId: string, name: string) => void
}

export function ComparisonActions({
  candidates,
  onScheduleInterview,
  onAddToPool,
  onEmail,
  onShortlist,
  onReject,
}: ComparisonActionsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.5 }}
      className="bg-white rounded-2xl border border-border p-5"
    >
      <h3 className="text-sm font-medium text-ink mb-4">Recommended Actions</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {candidates.map((candidate) => (
          <div key={candidate.candidateId} className="space-y-2">
            <p className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
              {candidate.name}
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Button size="xs" variant="default" onClick={() => onScheduleInterview(candidate.candidateId, candidate.name)}>
                <CalendarPlus className="h-3 w-3" />
                Interview
              </Button>
              <Button size="xs" variant="outline" onClick={() => onAddToPool(candidate.candidateId, candidate.name)}>
                <UserPlus className="h-3 w-3" />
                Pool
              </Button>
              <Button size="xs" variant="outline" onClick={() => onEmail(candidate.candidateId, candidate.name)}>
                <Mail className="h-3 w-3" />
                Email
              </Button>
              <Button size="xs" variant="outline" onClick={() => onShortlist(candidate.candidateId, candidate.name)}>
                <Archive className="h-3 w-3" />
                Shortlist
              </Button>
              <Button size="xs" variant="destructive" onClick={() => onReject(candidate.candidateId, candidate.name)}>
                <XCircle className="h-3 w-3" />
                Reject
              </Button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
