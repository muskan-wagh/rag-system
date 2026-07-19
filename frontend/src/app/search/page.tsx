"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Bookmark, Plus } from "lucide-react"
import { useApi } from "@/hooks/use-api"
import { SavedSearchCard } from "@/components/search/saved-search-card"
import { EmptyState } from "@/components/ui/empty-state"
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
    <div className="pt-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-medium text-text-primary" style={{ letterSpacing: "-0.01em", fontFamily: "var(--font-inter)" }}>Saved Searches</h1>
          <p className="text-sm text-text-secondary mt-1" style={{ fontFamily: "var(--font-inter)" }}>{searches.length} saved searches</p>
        </div>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="flex items-center gap-1.5 text-sm px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover transition-colors duration-120"
        >
          <Plus className="h-4 w-4" />
          New Search
        </button>
      </div>

      {showNewForm && (
        <form onSubmit={handleCreate} className="bg-card border border-border rounded-[10px] p-4 mb-6 space-y-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Search name (e.g. Senior React Dev)"
            className="w-full text-sm px-[14px] py-[10px] rounded-lg border border-input bg-white text-text-primary placeholder:text-text-muted focus:outline-none focus:border-ring transition-all duration-120"
          />
          <textarea
            value={newJdText}
            onChange={(e) => setNewJdText(e.target.value)}
            placeholder="Paste job description..."
            rows={4}
            className="w-full text-sm px-[14px] py-[10px] rounded-lg border border-input bg-white text-text-primary placeholder:text-text-muted focus:outline-none focus:border-ring transition-all duration-120 resize-y"
          />
          <div className="flex gap-2">
            <button type="submit" disabled={!newName.trim() || !newJdText.trim()}
              className="text-sm px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover disabled:opacity-50 transition-all duration-120"
            >
              Save
            </button>
            <button type="button" onClick={() => setShowNewForm(false)}
              className="text-sm px-4 py-2 bg-surface-secondary text-text-secondary rounded-lg hover:bg-[#F3F4F6] transition-all duration-120"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-card border border-border rounded-[10px] animate-pulse" />
          ))}
        </div>
      ) : searches.length === 0 ? (
        <EmptyState icon={Bookmark} title="No saved searches" description="Save your candidate search queries to quickly access them later." />
      ) : (
        <div className="space-y-6">
          {favorites.length > 0 && (
            <div>
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Favorites</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {favorites.map((s) => (
                  <SavedSearchCard key={s.id} search={s} onRun={handleRun} onToggleFavorite={handleToggleFavorite} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          )}
          <div>
            {favorites.length > 0 && <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">All Searches</h2>}
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
