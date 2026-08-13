"use client"

import { useState } from "react"
import { Users, Plus, X } from "lucide-react"
import useSWR from "swr"
import { useApi } from "@/hooks/use-api"
import { TalentPoolCard } from "@/components/search/talent-pool-card"
import { EmptyState } from "@/components/ui/empty-state"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"

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
    <div className="space-y-8">
      <PageHeader
        title="Talent Pools"
        description={isLoading ? "Loading…" : `${pools.length} pool${pools.length === 1 ? "" : "s"}`}
        actions={
          <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
            <Plus className="size-3.5" strokeWidth={1.5} />
            New Pool
          </Button>
        }
      />

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="space-y-3 rounded-lg border border-border bg-surface p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-[13px] font-medium text-ink">Create a talent pool</p>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="flex size-6 items-center justify-center rounded-md text-muted transition-colors duration-120 hover:bg-surface-secondary hover:text-ink"
              aria-label="Close"
            >
              <X className="size-3.5" strokeWidth={1.5} />
            </button>
          </div>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Pool name (e.g. Frontend Engineers)"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-ink outline-none transition-colors duration-120 placeholder:text-faint focus:border-border-hover"
          />
          <input
            type="text"
            value={newSearchId}
            onChange={(e) => setNewSearchId(e.target.value)}
            placeholder="Saved search ID (optional)"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-ink outline-none transition-colors duration-120 placeholder:text-faint focus:border-border-hover"
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={!newName.trim()}>
              Create Pool
            </Button>
            <Button variant="outline" type="button" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-lg border border-border bg-surface-secondary" />
          ))}
        </div>
      ) : pools.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No talent pools"
          description="Create a talent pool to track candidates for recurring roles."
        />
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