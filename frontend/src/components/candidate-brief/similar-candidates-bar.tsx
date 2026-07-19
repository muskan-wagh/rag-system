"use client"

import { Users, ChevronRight } from "lucide-react"
import Link from "next/link"
import type { Candidate } from "@/lib/types"
import { ROUTES } from "@/lib/constants"

interface SimilarCandidatesBarProps {
  candidates: Candidate[]
}

export function SimilarCandidatesBar({ candidates }: SimilarCandidatesBarProps) {
  if (candidates.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <div className="flex items-center gap-2 mb-3">
        <Users className="h-4 w-4 text-[#1F4770]" />
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Similar Candidates</h3>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {candidates.map((c) => (
          <Link
            key={c.id}
            href={ROUTES.candidateDetail(c.id)}
            className="flex items-center gap-2 shrink-0 px-3 py-2 rounded-lg border border-border hover:bg-muted/50 transition-colors"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#1F4770]/10 text-[#1F4770] text-xs font-medium">
              {c.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate max-w-[120px]">{c.name}</p>
              <p className="text-xs text-muted-foreground">{c.skills.slice(0, 2).join(", ")}</p>
            </div>
            <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}
