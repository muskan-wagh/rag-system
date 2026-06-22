"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, Mail, Phone, ExternalLink } from "lucide-react"
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
              <CardTitle className="text-2xl">{candidate.name}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{candidate.summary}</p>
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
        </div>

        <div className="space-y-4">
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
