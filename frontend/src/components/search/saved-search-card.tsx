"use client"

import { Star, Trash2, Search, Clock } from "lucide-react"
import type { SavedSearch } from "@/lib/types"

interface SavedSearchCardProps {
  search: SavedSearch
  onRun: (id: string) => void
  onToggleFavorite: (id: string, isFavorite: boolean) => void
  onDelete: (id: string) => void
  onRename?: (id: string, name: string) => void
}

export function SavedSearchCard({ search, onRun, onToggleFavorite, onDelete }: SavedSearchCardProps) {
  return (
    <div className="bg-white rounded-xl border border-border p-4 hover:border-[#1F4770]/20 transition-colors group">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-foreground truncate">{search.name}</h3>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(search.id, !search.is_favorite) }}
              className={`shrink-0 ${search.is_favorite ? 'text-amber-400' : 'text-muted-foreground opacity-0 group-hover:opacity-100'} transition-opacity`}
            >
              <Star className="h-3.5 w-3.5" fill={search.is_favorite ? 'currentColor' : 'none'} />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{search.jd_text.slice(0, 150)}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Search className="h-3 w-3" />
              {search.usage_count} runs
            </span>
            {search.last_used_at && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(search.last_used_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onRun(search.id)}
            className="p-1.5 rounded-lg hover:bg-[#1F4770]/10 text-muted-foreground hover:text-[#1F4770] transition-colors"
            title="Run search"
          >
            <Search className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(search.id)}
            className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
