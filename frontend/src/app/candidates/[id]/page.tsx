"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, Mail, Phone, ExternalLink } from "lucide-react"
import { searchCandidates, type Candidate, type RankingResult } from "@/lib/api"
import { ROUTES } from "@/lib/constants"

export default function CandidateDetailPage() {
  const params = useParams()
  const candidateId = params.id as string

  const [candidate, setCandidate] = useState<Candidate | null>(null)
  const [result, setResult] = useState<RankingResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function load() {
      try {
        const res = await searchCandidates(
          `Candidate profile for ${candidateId} skills experience education`,
          20,
        )
        if (res.success && res.data) {
          const found = res.data.results.find(
            (r) => r.candidate.id === candidateId,
          )
          if (found) {
            setCandidate(found.candidate)
            setResult(found)
          } else {
            setError("Candidate not found")
          }
        } else {
          setError(res.error || "Failed to load candidate")
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
      <div className="flex-1 space-y-6 p-6 md:p-8 pt-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-4">
            <Skeleton className="h-40" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-48" />
        </div>
      </div>
    )
  }

  if (error || !candidate) {
    return (
      <div className="flex-1 p-6 md:p-8 pt-6">
        <Link href={ROUTES.candidates}>
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Candidates
          </Button>
        </Link>
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground py-12">
            {error || "Candidate not found"}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 p-6 md:p-8 pt-6">
      <Link href={ROUTES.candidates}>
        <Button variant="ghost" className="mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Candidates
        </Button>
      </Link>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl">{candidate.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{candidate.summary}</p>
                </div>
                {result && (
                  <div className="text-right">
                    <div className="text-3xl font-bold">
                      {Math.round(result.scores.overall * 100)}%
                    </div>
                    <p className="text-xs text-muted-foreground">Match Score</p>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4 text-sm">
                {candidate.email && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" /> {candidate.email}
                  </span>
                )}
                {candidate.phone && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" /> {candidate.phone}
                  </span>
                )}
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-medium mb-2">Skills</h4>
                <div className="flex flex-wrap gap-1.5">
                  {candidate.skills.map((skill) => (
                    <Badge key={skill} variant="secondary">{skill}</Badge>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Experience</span>
                  <p className="font-medium">{candidate.experience} years</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Education</span>
                  <p className="font-medium capitalize">
                    {candidate.education.level} in {candidate.education.field}
                  </p>
                  {candidate.education.details && (
                    <p className="text-xs text-muted-foreground">{candidate.education.details}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {result && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Ranking Explanation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
                  {result.explanation}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          {result && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Score Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ScoreBar label="Skills" value={result.scores.skill} weight={40} />
                <ScoreBar label="Experience" value={result.scores.experience} weight={35} />
                <ScoreBar label="Education" value={result.scores.education} weight={25} />
                <Separator />
                <ScoreBar label="Overall" value={result.scores.overall} weight={100} variant="primary" />
              </CardContent>
            </Card>
          )}

          <Link href={ROUTES.compare}>
            <Button variant="outline" className="w-full">
              <ExternalLink className="mr-2 h-4 w-4" /> Compare with Others
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

function ScoreBar({
  label,
  value,
  weight,
  variant = "default",
}: {
  label: string
  value: number
  weight: number
  variant?: "default" | "primary"
}) {
  const pct = Math.round(value * 100)
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{pct}%</span>
      </div>
      <Progress
        value={pct}
        className={variant === "primary" ? "h-2.5 [&>div]:bg-primary" : "h-2"}
      />
      <p className="text-xs text-muted-foreground">Weight: {weight}%</p>
    </div>
  )
}
