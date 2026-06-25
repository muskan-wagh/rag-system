"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, Mail, Phone, ExternalLink, GraduationCap, Briefcase, Wrench, Sparkles } from "lucide-react"
import { getCandidate, type Candidate } from "@/lib/api"
import { ROUTES } from "@/lib/constants"

export default function CandidateDetailPage() {
  const params = useParams()
  const candidateId = params.id as string

  const [candidate, setCandidate] = useState<Candidate | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function load() {
      try {
        const res = await getCandidate(candidateId)
        if (res.success && res.data) {
          setCandidate(res.data)
        } else {
          setError(res.error || "Candidate not found")
        }
      } catch {
        setError("Failed to connect to server")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [candidateId])

  if (loading) {
    return (
      <div className="flex-1 max-w-4xl mx-auto px-4 md:px-6 py-8">
        <Skeleton className="h-4 w-32 bg-white/[0.06] mb-6" />
        <div className="glass rounded-2xl p-6 ring-1 ring-white/[0.06]">
          <div className="flex gap-4 mb-6">
            <Skeleton className="h-14 w-14 rounded-xl bg-white/[0.06]" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-48 bg-white/[0.06]" />
              <Skeleton className="h-3 w-full bg-white/[0.06]" />
            </div>
          </div>
          <Skeleton className="h-32 bg-white/[0.06]" />
        </div>
      </div>
    )
  }

  if (error || !candidate) {
    return (
      <div className="flex-1 max-w-4xl mx-auto px-4 md:px-6 py-8">
        <Link href={ROUTES.candidates}>
          <Button variant="ghost" className="mb-4 text-white/50 hover:text-white">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Candidates
          </Button>
        </Link>
        <div className="glass rounded-2xl p-10 text-center ring-1 ring-white/[0.06]">
          <p className="text-sm text-white/40">{error || "Candidate not found"}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 max-w-4xl mx-auto px-4 md:px-6 py-8">
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <Link href={ROUTES.candidates}>
          <Button variant="ghost" className="mb-6 text-white/50 hover:text-white text-xs">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Candidates
          </Button>
        </Link>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="glass rounded-2xl p-6 md:p-8 ring-1 ring-white/[0.06] mb-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex items-start gap-4 flex-1">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600/30 to-blue-600/30 ring-1 ring-white/[0.1]">
                <span className="text-xl font-semibold text-white/80">
                  {candidate.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-xl font-semibold text-white">{candidate.name}</h1>
                  <div className="rounded-full bg-gradient-to-r from-purple-500 to-blue-500 px-2 py-0.5 text-[10px] font-medium text-white">
                    Top Match
                  </div>
                </div>
                <p className="text-sm text-white/50">{candidate.summary}</p>
                <div className="flex flex-wrap gap-3 mt-3">
                  {candidate.email && (
                    <span className="flex items-center gap-1.5 text-xs text-white/40">
                      <Mail className="h-3.5 w-3.5 text-purple-400" />
                      {candidate.email}
                    </span>
                  )}
                  {candidate.phone && (
                    <span className="flex items-center gap-1.5 text-xs text-white/40">
                      <Phone className="h-3.5 w-3.5 text-blue-400" />
                      {candidate.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Link href={ROUTES.compare}>
              <Button
                variant="outline"
                className="border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.06] text-xs h-8"
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Compare
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="glass rounded-2xl p-6 ring-1 ring-white/[0.06] h-full">
            <div className="flex items-center gap-2 mb-4">
              <Wrench className="h-4 w-4 text-purple-400" />
              <h2 className="text-sm font-medium text-white">Skills</h2>
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
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <div className="glass rounded-2xl p-6 ring-1 ring-white/[0.06] h-full">
            <div className="flex items-center gap-2 mb-4">
              <Briefcase className="h-4 w-4 text-blue-400" />
              <h2 className="text-sm font-medium text-white">Experience</h2>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-gradient">{candidate.experience}</span>
              <span className="text-sm text-white/40">years</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="glass rounded-2xl p-6 ring-1 ring-white/[0.06] h-full">
            <div className="flex items-center gap-2 mb-4">
              <GraduationCap className="h-4 w-4 text-cyan-400" />
              <h2 className="text-sm font-medium text-white">Education</h2>
            </div>
            <p className="text-sm text-white/70 capitalize">
              {candidate.education.level} in {candidate.education.field}
            </p>
            {candidate.education.details && (
              <p className="text-xs text-white/40 mt-1">{candidate.education.details}</p>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <div className="glass rounded-2xl p-6 ring-1 ring-white/[0.06] h-full">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-purple-400" />
              <h2 className="text-sm font-medium text-white">AI Summary</h2>
            </div>
            <p className="text-xs text-white/50 leading-relaxed">
              {candidate.summary || "No AI summary available for this candidate."}
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
