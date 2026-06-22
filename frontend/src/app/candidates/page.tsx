"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, ExternalLink } from "lucide-react"
import Link from "next/link"
import { searchCandidates, type RankingResult } from "@/lib/api"
import { ROUTES } from "@/lib/constants"

export default function CandidatesPage() {
  const [jdText, setJdText] = useState("")
  const [results, setResults] = useState<RankingResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [limit, setLimit] = useState("10")

  async function handleSearch() {
    if (!jdText.trim()) return
    setLoading(true)
    setError("")
    try {
      const res = await searchCandidates(jdText, parseInt(limit))
      if (res.success && res.data) {
        setResults(res.data.results)
      } else {
        setError(res.error || "Search failed")
      }
    } catch {
      setError("Failed to connect to server")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 space-y-6 p-6 md:p-8 pt-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Candidate Search</h1>
        <p className="text-muted-foreground mt-1">
          Paste a job description to find ranked candidates.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex gap-3">
              <Input
                placeholder="Paste job description here..."
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                className="flex-1 min-h-[44px]"
              />
              <Select value={limit} onValueChange={(v) => v && setLimit(v)}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[5, 10, 20].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleSearch} disabled={loading || !jdText.trim()}>
                <Search className="mr-2 h-4 w-4" />
                {loading ? "Searching..." : "Search"}
              </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-full" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="grid gap-4">
          {results.map((result) => (
            <Link key={result.candidate.id} href={ROUTES.candidateDetail(result.candidate.id)}>
              <Card className="transition-colors hover:bg-muted/50 cursor-pointer">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold truncate">{result.candidate.name}</h3>
                        <Badge variant={result.scores.overall >= 0.7 ? "default" : "secondary"}>
                          {Math.round(result.scores.overall * 100)}% Match
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {result.candidate.summary}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {result.candidate.skills.slice(0, 6).map((skill) => (
                          <Badge key={skill} variant="outline" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                        {result.candidate.skills.length > 6 && (
                          <Badge variant="outline" className="text-xs">
                            +{result.candidate.skills.length - 6}
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>{result.candidate.experience} yrs exp</span>
                        <span>{result.candidate.education.level}</span>
                        <span>{result.candidate.education.field}</span>
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {!loading && !error && results.length === 0 && jdText && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground py-12">
            No candidates found. Try adjusting the job description.
          </CardContent>
        </Card>
      )}

      {!loading && results.length === 0 && !jdText && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground py-12">
            Paste a job description and click Search to find ranked candidates.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
