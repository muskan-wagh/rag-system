"use client"

import type { CompareResult } from "@/lib/api"
import { ComparisonResults } from "./comparison/comparison-results"

interface ComparisonViewProps {
  result: CompareResult
  onScheduleInterview?: (candidateId: string, name: string) => void
  onAddToPool?: (candidateId: string, name: string) => void
  onEmail?: (candidateId: string, name: string) => void
  onShortlist?: (candidateId: string, name: string) => void
  onReject?: (candidateId: string, name: string) => void
}

export function ComparisonView(props: ComparisonViewProps) {
  return <ComparisonResults {...props} />
}
