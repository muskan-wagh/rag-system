"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Search, X, Loader2, User } from "lucide-react"
import { useApi } from "@/hooks/use-api"

interface CandidateSearchResult {
  id: string
  full_name?: string
  current_title?: string
  current_company?: string
}

interface CandidateSearchInputProps {
  index: number
  selected: CandidateSearchResult | null
  onSelect: (candidate: CandidateSearchResult | null) => void
}

export function CandidateSearchInput({ index, selected, onSelect }: CandidateSearchInputProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<CandidateSearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const api = useApi()

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      setIsOpen(false)
      return
    }
    setSearching(true)
    try {
      const res = await api.getAllCandidates({ search: q, limit: 10 })
      if (res.success && res.data) {
        setResults(res.data.candidates)
        setIsOpen(true)
      }
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [api])

  function handleInputChange(value: string) {
    setQuery(value)
    if (selected) onSelect(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(value), 300)
  }

  function handleSelect(candidate: CandidateSearchResult) {
    onSelect(candidate)
    setQuery("")
    setResults([])
    setIsOpen(false)
  }

  function handleClear() {
    onSelect(null)
    setQuery("")
    setResults([])
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <div ref={containerRef} className="relative flex-1">
      {selected ? (
        <div className="flex items-center gap-2 w-full bg-primary/5 text-sm text-foreground rounded-xl border border-primary/20 px-3 py-2">
          <User className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="flex-1 truncate">
            <span className="font-medium">{selected.full_name}</span>
            {(selected.current_title || selected.current_company) && (
              <span className="text-muted-foreground ml-1">
                — {selected.current_title || ""}
                {selected.current_title && selected.current_company ? " @ " : ""}
                {selected.current_company || ""}
              </span>
            )}
          </span>
          <button
            onClick={handleClear}
            className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            placeholder={`Search candidate ${index + 1} by name...`}
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => { if (results.length > 0) setIsOpen(true) }}
            className="w-full bg-muted/30 text-sm text-foreground placeholder-muted-foreground/50 outline-none rounded-xl border border-border pl-9 pr-3 py-2 focus:border-primary/30 transition-colors"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
        </div>
      )}

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-xl border border-border shadow-lg overflow-hidden">
          {results.map((candidate) => (
            <button
              key={candidate.id}
              onClick={() => handleSelect(candidate)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors border-b border-border last:border-b-0"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <span className="text-[10px] font-medium text-primary">
                  {(candidate.full_name || "?")
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {candidate.full_name || "Unknown"}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {candidate.current_title || ""}
                  {candidate.current_title && candidate.current_company ? " @ " : ""}
                  {candidate.current_company || ""}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && query.trim() && !searching && results.length === 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-xl border border-border shadow-lg p-3">
          <p className="text-xs text-muted-foreground text-center">No candidates found</p>
        </div>
      )}
    </div>
  )
}
