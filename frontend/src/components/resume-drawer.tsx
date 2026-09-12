"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { X, Mail, Phone, GraduationCap, Briefcase, Wrench, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GmailOutreachModal } from "@/components/gmail-outreach-modal"
import { GmailLogo } from "@/components/gmail-logo"
import { ROUTES } from "@/lib/constants"
import type { Candidate } from "@/lib/api"

interface ResumeDrawerProps {
  candidate: Candidate | null
  onClose: () => void
}

export function ResumeDrawer({ candidate, onClose }: ResumeDrawerProps) {
  const router = useRouter()
  const [showEmailModal, setShowEmailModal] = useState(false)
  return (
    <AnimatePresence>
      {candidate && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/10 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-lg z-50 bg-surface border-l border-border overflow-y-auto shadow-xl"
          >
            <div className="sticky top-0 bg-surface/90 backdrop-blur-xl border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-sm font-medium text-ink">Candidate Profile</h2>
              <button
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-surface-secondary transition-colors"
              >
                <X className="h-4 w-4 text-muted" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4 pb-4 border-b border-border">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-ink/10 ring-1 ring-border">
                  <span className="text-lg font-semibold text-ink/70">
                    {candidate.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-medium text-ink">{candidate.name}</h3>
                  <p className="text-xs text-muted mt-0.5">{candidate.summary}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {candidate.email && (
                  <span className="flex items-center gap-1.5 text-xs text-muted bg-surface-secondary rounded-lg px-2.5 py-1">
                    <Mail className="h-3.5 w-3.5 text-ink" />
                    {candidate.email}
                  </span>
                )}
                {candidate.phone && (
                  <span className="flex items-center gap-1.5 text-xs text-muted bg-surface-secondary rounded-lg px-2.5 py-1">
                    <Phone className="h-3.5 w-3.5 text-accent" />
                    {candidate.phone}
                  </span>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Wrench className="h-4 w-4 text-ink" />
                  <h4 className="text-xs font-medium text-ink/70 uppercase tracking-wider">Skills</h4>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {candidate.skills.length > 0 ? candidate.skills.map((skill) => (
                    <Badge key={skill} variant="secondary" className="text-xs bg-ink/5 text-ink">
                      {skill}
                    </Badge>
                  )) : (
                    <p className="text-xs text-muted">No skills listed</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface-secondary/40 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Briefcase className="h-3.5 w-3.5 text-accent" />
                    <h4 className="text-xs font-medium text-ink/70">Experience</h4>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-ink">{candidate.experience}</span>
                    <span className="text-xs text-muted">years</span>
                  </div>
                </div>
                <div className="bg-surface-secondary/40 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <GraduationCap className="h-3.5 w-3.5 text-chart-3" />
                    <h4 className="text-xs font-medium text-ink/70">Education</h4>
                  </div>
                  <p className="text-xs text-ink/80 capitalize leading-relaxed">
                    {candidate.education?.level ?? "N/A"}{candidate.education?.field ? ` in ${candidate.education.field}` : ""}
                  </p>
                  {candidate.education?.details && (
                    <p className="text-[10px] text-muted mt-0.5">{candidate.education.details}</p>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-ink" />
                  <h4 className="text-xs font-medium text-ink/70 uppercase tracking-wider">Summary</h4>
                </div>
                <div className="bg-ink/[0.02] rounded-xl p-4 border border-ink/5">
                  <p className="text-xs text-muted leading-relaxed">
                    {candidate.summary || "No summary available."}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  className="flex-1 bg-ink text-canvas hover:bg-ink/90 text-xs"
                  onClick={() => router.push(ROUTES.candidateDetail(candidate.id))}
                >
                  View Full Profile
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs"
                  disabled={!candidate.email}
                  title={candidate.email ? `Send outreach to ${candidate.name}` : "No email on file for this candidate"}
                  onClick={() => setShowEmailModal(true)}
                >
                  <GmailLogo className="size-3.5" />
                  Send Email
                </Button>
              </div>
            </div>
          </motion.div>
          {showEmailModal && (
            <GmailOutreachModal
              open={showEmailModal}
              onClose={() => setShowEmailModal(false)}
              candidateId={candidate.id}
              candidateName={candidate.name}
              candidateEmail={candidate.email || ""}
            />
          )}
        </>
      )}
    </AnimatePresence>
  )
}
