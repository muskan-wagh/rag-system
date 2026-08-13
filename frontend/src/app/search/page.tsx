"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Bookmark, Plus, X } from "lucide-react"
import { useApi } from "@/hooks/use-api"
import { SavedSearchCard } from "@/components/search/saved-search-card"
import { EmptyState } from "@/components/ui/empty-state"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { ROUTES } from "@/lib/constants"
import type { SavedSearch } from "@/lib/types"

export default function SavedSearchesPage() {
  const api = useApi()
  const router = useRouter()
  const [searches, setSearches] = useState<SavedSearch[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newName, setNewName] = useState("")
  const [newJdText, setNewJdText] = useState("")

  useEffect(() => {
    async function load() {
      const res = await api.listSavedSearches()
      if (res.success && res.data) setSearches(res.data)
      setLoading(false)
    }
    load()
  }, [api])

  const handleRun = useCallback((id: string) => {
    const search = searches.find((s) => s.id === id)
    if (search) {
      router.push(`${ROUTES.candidateSearch}?jd=${encodeURIComponent(search.jd_text)}`)
    }
  }, [searches, router])

  const handleToggleFavorite = useCallback(async (id: string, isFavorite: boolean) => {
    await api.updateSavedSearch(id, { is_favorite: isFavorite })
    setSearches((prev) => prev.map((s) => s.id === id ? { ...s, is_favorite: isFavorite } : s))
  }, [api])

  const handleDelete = useCallback(async (id: string) => {
    await api.deleteSavedSearch(id)
    setSearches((prev) => prev.filter((s) => s.id !== id))
  }, [api])

  const handleCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || !newJdText.trim()) return
    const res = await api.createSavedSearch(newName.trim(), newJdText.trim())
    if (res.success && res.data) {
      setSearches((prev) => [res.data!, ...prev])
      setNewName("")
      setNewJdText("")
      setShowNewForm(false)
    }
  }, [api, newName, newJdText])

  const favorites = searches.filter((s) => s.is_favorite)
  const recent = searches.filter((s) => !s.is_favorite)

  return (
    <div className="space-y-8">
      <PageHeader
        title="Saved Searches"
        description={`${searches.length} saved search${searches.length === 1 ? "" : "es"}`}
        actions={
          <Button size="sm" onClick={() => setShowNewForm((v) => !v)}>
            <Plus className="size-3.5" strokeWidth={1.5} />
            New Search
          </Button>
        }
      />

      {showNewForm && (
        <form onSubmit={handleCreate} className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[13px] font-medium text-ink">Save a new search</p>
            <button
              type="button"
              onClick={() => setShowNewForm(false)}
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
            placeholder="Search name (e.g. Senior React Dev)"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-ink outline-none transition-colors duration-120 placeholder:text-faint focus:border-border-hover"
          />
          <textarea
            value={newJdText}
            onChange={(e) => setNewJdText(e.target.value)}
            placeholder="Paste job description…"
            rows={4}
            className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-ink outline-none transition-colors duration-120 placeholder:text-faint focus:border-border-hover"
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={!newName.trim() || !newJdText.trim()}>
              Save
            </Button>
            <Button variant="outline" type="button" onClick={() => setShowNewForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg border border-border bg-surface-secondary" />
          ))}
        </div>
      ) : searches.length === 0 ? (
        <EmptyState icon={Bookmark} title="No saved searches" description="Save your candidate search queries to quickly access them later." />
      ) : (
        <div className="space-y-6">
          {favorites.length > 0 && (
            <div>
              <h2 className="mb-3 text-[10px] font-medium uppercase tracking-[0.07em] text-faint">Favorites</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {favorites.map((s) => (
                  <SavedSearchCard key={s.id} search={s} onRun={handleRun} onToggleFavorite={handleToggleFavorite} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          )}
          <div>
            {favorites.length > 0 && <h2 className="mb-3 text-[10px] font-medium uppercase tracking-[0.07em] text-faint">All Searches</h2>}
            <div className="grid gap-3 md:grid-cols-2">
              {recent.map((s) => (
                <SavedSearchCard key={s.id} search={s} onRun={handleRun} onToggleFavorite={handleToggleFavorite} onDelete={handleDelete} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}