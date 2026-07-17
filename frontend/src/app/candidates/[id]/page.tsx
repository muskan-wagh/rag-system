"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, Mail, Phone, GraduationCap, Briefcase, Wrench, Sparkles, Award, CheckCircle2 } from "lucide-react"
import { useApi } from "@/hooks/use-api"
import type { Candidate } from "@/lib/api"
import { ROUTES } from "@/lib/constants"

export default function CandidateDetailPage() {
  const params = useParams()
  const candidateId = params.id as string
  const api = useApi()

  const [candidate, setCandidate] = useState<Candidate | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function load() {
      try {
        const res = await api.getCandidate(candidateId)
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
      <div className="flex-1 mx-auto max-w-5xl px-4 md:px-6 py-8">
        <Skeleton className="h-4 w-32 mb-6" />
        <div className="bg-white rounded-2xl p-6 border border-border">
          <div className="flex gap-4 mb-6">
            <Skeleton className="h-14 w-14 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
          <Skeleton className="h-32" />
        </div>
      </div>
    )
  }

  if (error || !candidate) {
    return (
      <div className="flex-1 mx-auto max-w-5xl px-4 md:px-6 py-8">
        <Link href={ROUTES.candidateSearch}>
          <Button variant="ghost" className="mb-4 text-muted-foreground hover:text-foreground text-xs">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Search
          </Button>
        </Link>
        <div className="bg-white rounded-2xl p-10 text-center border border-border">
          <p className="text-sm text-muted-foreground">{error || "Candidate not found"}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 mx-auto max-w-5xl px-4 md:px-6 py-8">
      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
        <Link href={ROUTES.candidateSearch}>
          <Button variant="ghost" className="mb-5 text-muted-foreground hover:text-foreground text-xs">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Search
          </Button>
        </Link>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div className="bg-white rounded-2xl p-6 md:p-8 border border-border mb-6">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="flex items-start gap-4 flex-1">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-border">
                <span className="text-xl font-semibold text-foreground/70">
                  {candidate.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-semibold text-foreground mb-1">{candidate.name}</h1>
                <p className="text-sm text-muted-foreground">{candidate.summary}</p>
                <div className="flex flex-wrap gap-2 mt-3">
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
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="bg-white rounded-2xl p-6 border border-border h-full">
            <div className="flex items-center gap-2 mb-4">
              <Wrench className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-medium text-foreground">Skills</h2>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {candidate.skills.length > 0 ? candidate.skills.map((skill) => (
                <Badge key={skill} variant="secondary" className="text-xs bg-primary/5 text-primary">
                  <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                  {skill}
                </Badge>
              )) : (
                <p className="text-xs text-muted-foreground">No skills listed</p>
              )}
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="bg-white rounded-2xl p-6 border border-border h-full">
            <div className="flex items-center gap-2 mb-4">
              <Briefcase className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-medium text-foreground">Experience</h2>
            </div>
            <div className="flex items-baseline gap-1 mb-3">
              <span className="text-3xl font-bold text-primary">{candidate.experience}</span>
              <span className="text-sm text-muted-foreground">years total</span>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="bg-white rounded-2xl p-6 border border-border h-full">
            <div className="flex items-center gap-2 mb-4">
              <GraduationCap className="h-4 w-4 text-chart-3" />
              <h2 className="text-sm font-medium text-foreground">Education</h2>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-3/10">
                <GraduationCap className="h-5 w-5 text-chart-3" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground capitalize">
                  {candidate.education?.level || "N/A"}{candidate.education?.field ? ` in ${candidate.education.field}` : ""}
                </p>
                {candidate.education?.details && (
                  <p className="text-xs text-muted-foreground mt-0.5">{candidate.education.details}</p>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <div className="bg-white rounded-2xl p-6 border border-border h-full">
            <div className="flex items-center gap-2 mb-4">
              <Award className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-medium text-foreground">Summary</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {candidate.summary || "No summary available for this candidate."}
            </p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="md:col-span-2">
          <div className="bg-white rounded-2xl p-6 border border-border">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-medium text-foreground">AI Analysis</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              AI-powered analysis is available from the search results page, where candidates are ranked and explained based on a specific job description. Visit the{" "}
              <Link href={ROUTES.candidateSearch} className="text-primary hover:underline">Candidate Search</Link> page to see this candidate&apos;s ranking and AI insights.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
