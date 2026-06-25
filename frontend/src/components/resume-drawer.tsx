"use client"

import { motion, AnimatePresence } from "framer-motion"
import { X, Mail, Phone, GraduationCap, Briefcase, Wrench } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { Candidate } from "@/lib/api"

interface ResumeDrawerProps {
  candidate: Candidate | null
  onClose: () => void
}

export function ResumeDrawer({ candidate, onClose }: ResumeDrawerProps) {
  return (
    <AnimatePresence>
      {candidate && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-lg z-50 glass-heavy border-l border-white/[0.06] overflow-y-auto"
          >
            <div className="sticky top-0 glass-heavy border-b border-white/[0.06] px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-sm font-medium text-white">{candidate.name}</h2>
              <button
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white/[0.06] transition-colors"
              >
                <X className="h-4 w-4 text-white/60" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600/30 to-blue-600/30 ring-1 ring-white/[0.1]">
                  <span className="text-lg font-semibold text-white/80">
                    {candidate.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-white">{candidate.name}</h3>
                  <p className="text-xs text-white/40">{candidate.summary}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {candidate.email && (
                  <span className="flex items-center gap-1.5 text-xs text-white/50">
                    <Mail className="h-3.5 w-3.5 text-purple-400" />
                    {candidate.email}
                  </span>
                )}
                {candidate.phone && (
                  <span className="flex items-center gap-1.5 text-xs text-white/50">
                    <Phone className="h-3.5 w-3.5 text-blue-400" />
                    {candidate.phone}
                  </span>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Wrench className="h-3.5 w-3.5 text-purple-400" />
                  <h4 className="text-xs font-medium text-white/80 uppercase tracking-wider">Skills</h4>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {candidate.skills.map((skill) => (
                    <Badge
                      key={skill}
                      variant="outline"
                      className="text-xs border-white/[0.08] text-white/60 bg-white/[0.03]"
                    >
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Briefcase className="h-3.5 w-3.5 text-blue-400" />
                  <h4 className="text-xs font-medium text-white/80 uppercase tracking-wider">Experience</h4>
                </div>
                <div className="glass rounded-xl p-4 ring-1 ring-white/[0.06]">
                  <span className="text-2xl font-bold text-gradient">{candidate.experience}</span>
                  <span className="text-sm text-white/40 ml-1">years</span>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <GraduationCap className="h-3.5 w-3.5 text-cyan-400" />
                  <h4 className="text-xs font-medium text-white/80 uppercase tracking-wider">Education</h4>
                </div>
                <div className="glass rounded-xl p-4 ring-1 ring-white/[0.06] space-y-1">
                  <p className="text-sm text-white/80 capitalize">
                    {candidate.education.level} in {candidate.education.field}
                  </p>
                  {candidate.education.details && (
                    <p className="text-xs text-white/40">{candidate.education.details}</p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
