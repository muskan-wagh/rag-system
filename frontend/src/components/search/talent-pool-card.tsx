"use client"

import { Users, TrendingUp, UserPlus, Clock } from "lucide-react"
import Link from "next/link"
import type { TalentPool } from "@/lib/types"

interface TalentPoolCardProps {
  pool: TalentPool
}

export function TalentPoolCard({ pool }: TalentPoolCardProps) {
  return (
    <Link
      href={`/pools/${pool.id}`}
      className="block bg-white rounded-xl border border-border p-5 hover:border-[#1F4770]/20 hover:shadow-sm transition-all"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-foreground">{pool.name}</h3>
        <Users className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-2xl font-bold text-foreground">{pool.candidate_count}</p>
          <p className="text-xs text-muted-foreground">Candidates</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{pool.average_score > 0 ? `${(pool.average_score * 100).toFixed(0)}%` : '—'}</p>
          <p className="text-xs text-muted-foreground">Avg Match</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
        {pool.new_count > 0 && (
          <span className="flex items-center gap-1 text-emerald-600">
            <UserPlus className="h-3 w-3" />
            {pool.new_count} new
          </span>
        )}
        <span className="flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          {pool.highest_score > 0 ? `${(pool.highest_score * 100).toFixed(0)}%` : '—'} top
        </span>
        <span className="flex items-center gap-1 ml-auto">
          <Clock className="h-3 w-3" />
          {new Date(pool.updated_at || pool.created_at).toLocaleDateString()}
        </span>
      </div>
    </Link>
  )
}
