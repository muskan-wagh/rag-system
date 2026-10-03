"use client"

import { useCallback, useEffect, useState, startTransition } from "react"
import Link from "next/link"
import { ClipboardList, Plus, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useApi } from "@/hooks/use-api"
import { PageHeader } from "@/components/ui/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { ROUTES } from "@/lib/constants"
import type { Assessment } from "@/lib/types"

export default function AssessmentsPage() {
  const api = useApi()
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "published">("all")

  const load = useCallback(async () => {
    startTransition(() => setLoading(true))
    try {
      const res = await api.listAssessments(
        statusFilter === "all" ? {} : { status: statusFilter },
      )
      if (res.success && res.data) startTransition(() => setAssessments(res.data ?? []))
    } catch {
      toast.error("Failed to load assessments")
    } finally {
      startTransition(() => setLoading(false))
    }
  }, [api, statusFilter])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="pt-6 space-y-6">
      <PageHeader
        title="Assessments"
        description="Build skill assessments, publish them, and invite shortlisted candidates."
        actions={
          <Link href={ROUTES.assessmentNew}>
            <Button size="sm" className="bg-ink text-canvas hover:bg-ink/90">
              <Plus className="h-3.5 w-3.5 mr-1" /> New assessment
            </Button>
          </Link>
        }
      />

      <div className="flex gap-1.5">
        {(["all", "draft", "published"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`h-8 rounded-lg px-3 text-xs font-medium capitalize transition-colors ${
              statusFilter === s
                ? "bg-ink text-canvas"
                : "border border-border text-muted hover:bg-surface-secondary hover:text-ink"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="bg-surface rounded-lg border border-border overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : assessments.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No assessments yet"
            description="Create your first assessment — add questions, publish, then invite candidates."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Questions</TableHead>
                  <TableHead>Total marks</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assessments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Link href={ROUTES.assessmentDetail(a.id)} className="text-sm font-medium text-ink hover:underline">
                        {a.name || "Untitled assessment"}
                      </Link>
                      {a.skills?.length > 0 && (
                        <p className="text-xs text-faint">{a.skills.join(", ")}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={a.status === "published" ? "success" : "warning"}>{a.status}</Badge>
                    </TableCell>
                    <TableCell><span className="text-sm text-muted">{a.totalQuestions}</span></TableCell>
                    <TableCell><span className="text-sm text-muted">{a.totalMarks}</span></TableCell>
                    <TableCell><span className="text-sm text-muted">{a.duration_minutes} min</span></TableCell>
                    <TableCell className="text-right">
                      <Link href={ROUTES.assessmentDetail(a.id)}>
                        <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs">Open</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      {loading && (
        <p className="flex items-center gap-2 text-xs text-faint">
          <Loader2 className="size-3 animate-spin" /> Loading…
        </p>
      )}
    </div>
  )
}
