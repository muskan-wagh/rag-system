"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { GitCompare, Trash2, Plus } from "lucide-react"
import { compareCandidates, batchCandidates, type Candidate } from "@/lib/api"

export default function ComparePage() {
  const [jdText, setJdText] = useState("")
  const [candidateIds, setCandidateIds] = useState<string[]>(["", ""])
  const [comparison, setComparison] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [foundCandidates, setFoundCandidates] = useState<Map<string, Candidate>>(new Map())

  function updateId(index: number, value: string) {
    const next = [...candidateIds]
    next[index] = value
    setCandidateIds(next)
  }

  function addRow() {
    setCandidateIds([...candidateIds, ""])
  }

  function removeRow(index: number) {
    if (candidateIds.length <= 2) return
    setCandidateIds(candidateIds.filter((_, i) => i !== index))
  }

  async function handleCompare() {
    if (!jdText.trim() || candidateIds.some((id) => !id.trim())) {
      setError("Please fill in all fields")
      return
    }
    setLoading(true)
    setError("")

    try {
      const batchRes = await batchCandidates(candidateIds)
      const nameMap = new Map<string, Candidate>()
      if (batchRes.success && batchRes.data) {
        for (const candidate of batchRes.data) {
          nameMap.set(candidate.id, candidate)
        }
      }
      setFoundCandidates(nameMap)

      const compareRes = await compareCandidates(jdText, candidateIds)
      if (compareRes.success && compareRes.data) {
        setComparison(compareRes.data.comparison)
      } else {
        setError(compareRes.error || "Comparison failed")
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
        <h1 className="text-2xl font-bold tracking-tight">Compare Candidates</h1>
        <p className="text-muted-foreground mt-1">
          Compare multiple candidates side-by-side for the same job.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Job Description</label>
            <Input
              placeholder="Paste job description..."
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
            />
          </div>

          {candidateIds.map((id, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-sm text-muted-foreground mb-1 block">
                  Candidate {index + 1}
                  {foundCandidates.has(id) && (
                    <span className="ml-2 text-primary">
                      — {foundCandidates.get(id)?.name}
                    </span>
                  )}
                </label>
                <Input
                  placeholder="Candidate ID (e.g., cand-001)"
                  value={id}
                  onChange={(e) => updateId(index, e.target.value)}
                />
              </div>
              {candidateIds.length > 2 && (
                <Button variant="ghost" size="icon" className="mt-5" onClick={() => removeRow(index)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}

          <div className="flex gap-2">
            <Button variant="outline" onClick={addRow}>
              <Plus className="mr-2 h-4 w-4" /> Add Candidate
            </Button>
            <Button onClick={handleCompare} disabled={loading}>
              <GitCompare className="mr-2 h-4 w-4" />
              {loading ? "Comparing..." : "Compare"}
            </Button>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {loading && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      )}

      {comparison && !loading && (
        <Card>
          <CardHeader>
            <CardTitle>Comparison Results</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
              <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
                {comparison}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
