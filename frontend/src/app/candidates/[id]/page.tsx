"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ProgressBar } from "@/components/ui/progress-bar"
import { ScoreRing } from "@/components/ui/score-ring"
import { ArrowLeft, Mail, Phone, ExternalLink, GraduationCap, Briefcase, Wrench, Sparkles, Award, CheckCircle2, XCircle, Bookmark } from "lucide-react"
import { getCandidate, type Candidate } from "@/lib/api"
import { ROUTES } from "@/lib/constants"

const sampleMissingSkills = ["GraphQL", "Docker", "Kubernetes"]
const sampleStrengths = ["Strong React and TypeScript experience", "AWS certification", "Team leadership"]
const sampleWeaknesses = ["No GraphQL experience", "Limited startup experience"]

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
        <Link href={ROUTES.candidates}>
          <Button variant="ghost" className="mb-4 text-muted-foreground hover:text-foreground text-xs">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Candidates
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
        <Link href={ROUTES.candidates}>
          <Button variant="ghost" className="mb-5 text-muted-foreground hover:text-foreground text-xs">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Candidates
          </Button>
        </Link>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <div className="bg-white rounded-2xl p-6 md:p-8 border border-border mb-6">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="flex items-start gap-4 flex-1">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-border">
                <span className="text-xl font-semibold text-foreground/70">
                  {candidate.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h1 className="text-xl font-semibold text-foreground">{candidate.name}</h1>
                  <div className="rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-medium text-white">
                    Top Match
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    High confidence
                  </div>
                </div>
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
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="text-xs">
                <Bookmark className="mr-1.5 h-3.5 w-3.5" /> Save
              </Button>
              <Link href={ROUTES.compare}>
                <Button variant="outline" size="sm" className="text-xs">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Compare
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-border grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <ScoreRing value={0.92} size={64} label="Overall Match" />
            </div>
            {[
              { label: "Skills", value: 85 },
              { label: "Experience", value: 70 },
              { label: "Education", value: 90 },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <ScoreRing value={item.value / 100} size={64} label={item.label} />
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="bg-white rounded-2xl p-6 border border-border h-full">
            <div className="flex items-center gap-2 mb-4">
              <Wrench className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-medium text-foreground">Skills</h2>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {candidate.skills.map((skill) => (
                <Badge key={skill} variant="secondary" className="text-xs bg-primary/5 text-primary">
                  <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                  {skill}
                </Badge>
              ))}
            </div>
            {sampleMissingSkills.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs font-medium text-muted-foreground mb-2">Missing Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {sampleMissingSkills.map((skill) => (
                    <Badge key={skill} variant="outline" className="text-xs text-muted-foreground/60">
                      <XCircle className="h-2.5 w-2.5 mr-1" />
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <div className="bg-white rounded-2xl p-6 border border-border h-full">
            <div className="flex items-center gap-2 mb-4">
              <Award className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-medium text-foreground">Score Breakdown</h2>
            </div>
            <div className="space-y-3">
              <ProgressBar value={85} label="Skill Match" delay={0.2} />
              <ProgressBar value={70} label="Experience Match" color="bg-accent" delay={0.25} />
              <ProgressBar value={90} label="Education Match" color="bg-chart-3" delay={0.3} />
              <ProgressBar value={82} label="Overall" color="bg-primary" delay={0.35} />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="bg-white rounded-2xl p-6 border border-border h-full">
            <div className="flex items-center gap-2 mb-4">
              <Briefcase className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-medium text-foreground">Experience</h2>
            </div>
            <div className="flex items-baseline gap-1 mb-3">
              <span className="text-3xl font-bold text-primary">{candidate.experience}</span>
              <span className="text-sm text-muted-foreground">years total</span>
            </div>
            <div className="space-y-3">
              {[
                { role: "Senior Frontend Engineer", company: "Tech Corp", period: "2020 - Present", years: 4 },
                { role: "Frontend Developer", company: "Startup Inc", period: "2017 - 2020", years: 3 },
              ].map((exp, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-xl bg-muted/30">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-primary/60" />
                    {i < 1 && <div className="w-px flex-1 bg-border my-1" />}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">{exp.role}</p>
                    <p className="text-[11px] text-muted-foreground">{exp.company} · {exp.period}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
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
                  {candidate.education?.level ?? "N/A"} in {candidate.education?.field ?? "N/A"}
                </p>
                {candidate.education?.details && (
                  <p className="text-xs text-muted-foreground mt-0.5">{candidate.education.details}</p>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="md:col-span-2"
        >
          <div className="bg-white rounded-2xl p-6 border border-border">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-medium text-foreground">AI Analysis</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="bg-primary/[0.02] rounded-xl p-4 border border-primary/5">
                <h3 className="text-xs font-medium text-foreground mb-2">Strengths</h3>
                <ul className="space-y-1.5">
                  {sampleStrengths.map((s) => (
                    <li key={s} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-destructive/[0.02] rounded-xl p-4 border border-destructive/5">
                <h3 className="text-xs font-medium text-foreground mb-2">Weaknesses</h3>
                <ul className="space-y-1.5">
                  {sampleWeaknesses.map((w) => (
                    <li key={w} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <XCircle className="h-3 w-3 text-destructive/70 mt-0.5 shrink-0" />
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-chart-5/[0.02] rounded-xl p-4 border border-chart-5/5">
                <h3 className="text-xs font-medium text-foreground mb-2">Recommendation</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Strong candidate for the position. Highly recommend for initial interview based on skill alignment and experience level.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
