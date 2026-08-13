"use client"

import { useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Users, Trash2, BarChart3 } from "lucide-react"
import useSWR from "swr"
import { useApi } from "@/hooks/use-api"
import { Skeleton } from "@/components/ui/skeleton"
import type { TalentPool, ApiResponse } from "@/lib/types"

export default function PoolDetailPage() {
  const params = useParams()
  const poolId = params.id as string
  const api = useApi()

  const { data: poolRes, isLoading, mutate } = useSWR<ApiResponse<TalentPool>>(
    ["talent-pool", poolId],
    () => api.getTalentPool(poolId),
    { revalidateOnFocus: false },
  )
  const pool = poolRes?.data ?? null

  const handleRemove = useCallback(async (candidateId: string) => {
    await api.removeCandidateFromPool(poolId, candidateId)
    mutate()
  }, [api, poolId, mutate])

  if (isLoading) {
    return (
      <div className="">
        <Skeleton className="h-4 w-32 mb-6" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    )
  }

  if (!pool) {
    return (
      <div className="">
        <Link href="/pools" className="inline-flex items-center text-xs text-muted hover:text-ink mb-4">
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Pools
        </Link>
        <div className="rounded-lg border border-border bg-surface p-10 text-center">
          <p className="text-sm text-muted">Pool not found</p>
        </div>
      </div>
    )
  }

  const candidates = pool.candidates

  return (
    <div className="">
      <Link href="/pools" className="inline-flex items-center text-xs text-muted hover:text-ink mb-4">
        <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Pools
      </Link>

      <div className="bg-surface rounded-lg border border-border p-5 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-secondary">
            <Users className="h-5 w-5 text-ink" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-ink">{pool.name}</h1>
            <p className="text-sm text-muted">{pool.candidate_count} candidates</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 border-t border-border pt-4">
          <div>
            <p className="font-data text-[24px] font-medium text-ink">{pool.candidate_count}</p>
            <p className="text-xs text-muted">Total</p>
          </div>
          <div>
            <p className="font-data text-[24px] font-medium text-ink">
              {pool.average_score > 0 ? `${(pool.average_score * 100).toFixed(0)}%` : '—'}
            </p>
            <p className="text-xs text-muted">Average Score</p>
          </div>
          <div>
            <p className="font-data text-[24px] font-medium text-ink">
              {pool.highest_score > 0 ? `${(pool.highest_score * 100).toFixed(0)}%` : '—'}
            </p>
            <p className="text-xs text-muted">Highest Match</p>
          </div>
        </div>
      </div>

      {candidates && candidates.length > 0 ? (
        <div className="bg-surface rounded-lg border border-border">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-medium text-ink">Pool Candidates</h2>
          </div>
          <div className="divide-y divide-border">
            {candidates.map((pc) => (
              <div key={pc.id} className="flex items-center justify-between p-4 hover:bg-hover-tone">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{pc.candidate_name || pc.candidate_id}</p>
                  {pc.candidate_title && (
                    <p className="text-xs text-muted">{pc.candidate_title}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {pc.match_score > 0 && (
                    <span className="text-sm font-medium text-ink">{(pc.match_score * 100).toFixed(0)}%</span>
                  )}
                  <button
                    onClick={() => handleRemove(pc.candidate_id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-muted hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-surface p-10 text-center">
          <BarChart3 className="h-8 w-8 text-muted mx-auto mb-3" />
          <p className="text-sm text-muted">No candidates in this pool yet.</p>
        </div>
      )}
    </div>
  )
}
