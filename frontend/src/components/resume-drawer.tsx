"use client"

import { motion, AnimatePresence } from "framer-motion"
import { X, Mail, Phone, GraduationCap, Briefcase, Wrench, Sparkles, Award, Target, Bookmark } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ProgressBar } from "@/components/ui/progress-bar"
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
            className="fixed inset-0 bg-black/10 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-lg z-50 bg-white border-l border-border overflow-y-auto shadow-xl"
          >
            <div className="sticky top-0 bg-white/90 backdrop-blur-xl border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-sm font-medium text-foreground">Candidate Profile</h2>
              <div className="flex items-center gap-1">
                <button className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-muted transition-colors">
                  <Bookmark className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <button
                  onClick={onClose}
                  className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4 pb-4 border-b border-border">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-border">
                  <span className="text-lg font-semibold text-foreground/70">
                    {candidate.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-medium text-foreground">{candidate.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{candidate.summary}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {candidate.email && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-lg px-2.5 py-1">
                    <Mail className="h-3.5 w-3.5 text-primary" />
                    {candidate.email}
                  </span>
                )}
                {candidate.phone && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-lg px-2.5 py-1">
                    <Phone className="h-3.5 w-3.5 text-accent" />
                    {candidate.phone}
                  </span>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Wrench className="h-4 w-4 text-primary" />
                  <h4 className="text-xs font-medium text-foreground/70 uppercase tracking-wider">Skills</h4>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {candidate.skills.map((skill) => (
                    <Badge key={skill} variant="secondary" className="text-xs bg-primary/5 text-primary">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/40 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Briefcase className="h-3.5 w-3.5 text-accent" />
                    <h4 className="text-xs font-medium text-foreground/70">Experience</h4>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-primary">{candidate.experience}</span>
                    <span className="text-xs text-muted-foreground">years</span>
                  </div>
                </div>
                <div className="bg-muted/40 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <GraduationCap className="h-3.5 w-3.5 text-chart-3" />
                    <h4 className="text-xs font-medium text-foreground/70">Education</h4>
                  </div>
                  <p className="text-xs text-foreground/80 capitalize leading-relaxed">
                    {candidate.education.level} in {candidate.education.field}
                  </p>
                  {candidate.education.details && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">{candidate.education.details}</p>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Award className="h-4 w-4 text-primary" />
                  <h4 className="text-xs font-medium text-foreground/70 uppercase tracking-wider">Score Breakdown</h4>
                </div>
                <div className="space-y-2.5">
                  <ProgressBar value={85} label="Skill Match" color="bg-primary" />
                  <ProgressBar value={70} label="Experience Match" color="bg-accent" />
                  <ProgressBar value={90} label="Education Match" color="bg-chart-3" />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h4 className="text-xs font-medium text-foreground/70 uppercase tracking-wider">AI Summary</h4>
                </div>
                <div className="bg-primary/[0.02] rounded-xl p-4 border border-primary/5">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {candidate.summary || "Strong candidate with relevant skills and experience. Good match for the position based on skill alignment and background."}
                  </p>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Target className="h-4 w-4 text-accent" />
                  <h4 className="text-xs font-medium text-foreground/70 uppercase tracking-wider">Skill Gap Analysis</h4>
                </div>
                <div className="space-y-2">
                  {["GraphQL", "Docker"].map((skill) => (
                    <div key={skill} className="flex items-center justify-between text-xs bg-muted/30 rounded-lg px-3 py-2">
                      <span className="text-muted-foreground">{skill}</span>
                      <span className="text-destructive/70">Missing</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button size="sm" className="flex-1 bg-primary text-white hover:bg-primary/90 text-xs">
                  View Full Profile
                </Button>
                <Button variant="outline" size="sm" className="flex-1 text-xs">
                  Compare
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
