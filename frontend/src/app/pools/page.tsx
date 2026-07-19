"use client"

import { useState } from "react"
import { Users, Plus } from "lucide-react"
import useSWR from "swr"
import { useApi } from "@/hooks/use-api"
import { TalentPoolCard } from "@/components/search/talent-pool-card"
import { EmptyState } from "@/components/ui/empty-state"


export default function TalentPoolsPage() {
  const api = useApi()
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState("")
  const [newSearchId, setNewSearchId] = useState("")

  const { data: poolsRes, isLoading, mutate } = useSWR(
    "talent-pools",
    () => api.listTalentPools(),
    { revalidateOnFocus: false },
  )
  const pools = poolsRes?.data ?? []

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    const res = await api.createTalentPool(newName.trim(), newSearchId || undefined)
    if (res.success && res.data) {
      mutate()
      setNewName("")
      setNewSearchId("")
      setShowCreate(false)
    }
  }

  return (
    <div className="pt-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-medium text-text-primary" style={{ letterSpacing: "-0.01em", fontFamily: "var(--font-inter)" }}>Talent Pools</h1>
          <p className="text-sm text-text-secondary mt-1" style={{ fontFamily: "var(--font-inter)" }}>{isLoading ? "..." : `${pools.length} pools`}</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 text-sm px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover transition-colors duration-120"
        >
          <Plus className="h-4 w-4" />
          New Pool
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-border p-4 mb-6 space-y-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Pool name (e.g. Frontend Engineers)"
            className="w-full text-sm px-[14px] py-[10px] rounded-lg border border-input bg-white text-text-primary placeholder:text-text-muted focus:outline-none focus:border-ring transition-all duration-120"
          />
          <input
            type="text"
            value={newSearchId}
            onChange={(e) => setNewSearchId(e.target.value)}
            placeholder="Saved search ID (optional)"
            className="w-full text-sm px-[14px] py-[10px] rounded-lg border border-input bg-white text-text-primary placeholder:text-text-muted focus:outline-none focus:border-ring transition-all duration-120"
          />
          <div className="flex gap-2">
            <button type="submit" disabled={!newName.trim()}
              className="text-sm px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover disabled:opacity-50 transition-all duration-120"
            >
              Create Pool
            </button>
            <button type="button" onClick={() => setShowCreate(false)}
              className="text-sm px-4 py-2 bg-surface-secondary text-text-secondary rounded-lg hover:bg-[#F3F4F6] transition-all duration-120"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-card border border-border rounded-[10px] animate-pulse" />
          ))}
        </div>
      ) : pools.length === 0 ? (
        <EmptyState icon={Users} title="No talent pools" description="Create a talent pool to track candidates for recurring roles." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pools.map((pool) => (
            <TalentPoolCard key={pool.id} pool={pool} />
          ))}
        </div>
      )}
    </div>
  )
}
