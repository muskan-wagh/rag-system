"use client"

import { useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Users, Trash2, BarChart3 } from "lucide-react"
import useSWR from "swr"
import { useApi } from "@/hooks/use-api"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { TalentPool, PoolCandidate, ApiResponse } from "@/lib/types"

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
      <div className="pt-6">
        <Skeleton className="h-4 w-32 mb-6" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  if (!pool) {
    return (
      <div className="pt-6">
        <Link href="/pools" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Pools
        </Link>
        <div className="bg-white rounded-xl p-10 text-center border border-border">
          <p className="text-sm text-muted-foreground">Pool not found</p>
        </div>
      </div>
    )
  }

  const candidates = (pool as any).candidates as PoolCandidate[] | undefined

  return (
    <div className="pt-6">
      <Link href="/pools" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Pools
      </Link>

      <div className="bg-white rounded-xl border border-border p-5 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1F4770]/10">
            <Users className="h-5 w-5 text-[#1F4770]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">{pool.name}</h1>
            <p className="text-sm text-muted-foreground">{pool.candidate_count} candidates</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 border-t border-border pt-4">
          <div>
            <p className="text-2xl font-bold text-foreground">{pool.candidate_count}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">
              {pool.average_score > 0 ? `${(pool.average_score * 100).toFixed(0)}%` : '—'}
            </p>
            <p className="text-xs text-muted-foreground">Average Score</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">
              {pool.highest_score > 0 ? `${(pool.highest_score * 100).toFixed(0)}%` : '—'}
            </p>
            <p className="text-xs text-muted-foreground">Highest Match</p>
          </div>
        </div>
      </div>

      {candidates && candidates.length > 0 ? (
        <div className="bg-white rounded-xl border border-border">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-medium text-foreground">Pool Candidates</h2>
          </div>
          <div className="divide-y divide-border">
            {candidates.map((pc) => (
              <div key={pc.id} className="flex items-center justify-between p-4 hover:bg-muted/30">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{pc.candidate_name || pc.candidate_id}</p>
                  {pc.candidate_title && (
                    <p className="text-xs text-muted-foreground">{pc.candidate_title}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {pc.match_score > 0 && (
                    <span className="text-sm font-medium text-[#1F4770]">{(pc.match_score * 100).toFixed(0)}%</span>
                  )}
                  <button
                    onClick={() => handleRemove(pc.candidate_id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl p-10 text-center border border-border">
          <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No candidates in this pool yet.</p>
        </div>
      )}
    </div>
  )
}
