"use client"

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import type { RankingResult, ParsedJD, SearchFilters } from "./api"

export interface FilterFormValues {
  minExp: string
  maxExp: string
  education: string
  skills: string
}

export const CACHE_TTL = 30 * 60 * 1000

export function isCacheValid(timestamp: number | null): boolean {
  if (!timestamp) return false
  return Date.now() - timestamp < CACHE_TTL
}

interface SearchState {
  jdText: string
  parsedJD: ParsedJD | null
  results: RankingResult[]
  activeTab: "results" | "analytics"
  viewMode: "list" | "grid"
  filters: SearchFilters
  filterFormValues: FilterFormValues
  showMobileFilters: boolean
  loading: boolean
  error: string
  lastSearchTimestamp: number | null

  setJdText: (text: string) => void
  setResults: (results: RankingResult[], parsedJD: ParsedJD | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string) => void
  setActiveTab: (tab: "results" | "analytics") => void
  setViewMode: (mode: "list" | "grid") => void
  setFilters: (filters: SearchFilters) => void
  setFilterFormValues: (values: FilterFormValues) => void
  setShowMobileFilters: (show: boolean) => void
  reset: () => void
}

const initialFilterFormValues: FilterFormValues = {
  minExp: "",
  maxExp: "",
  education: "",
  skills: "",
}

export const useSearchStore = create<SearchState>()(
  persist(
    (set) => ({
      jdText: "",
      parsedJD: null,
      results: [],
      activeTab: "results",
      viewMode: "list",
      filters: {},
      filterFormValues: { ...initialFilterFormValues },
      showMobileFilters: false,
      loading: false,
      error: "",
      lastSearchTimestamp: null,

      setJdText: (jdText) => set({ jdText }),
      setResults: (results, parsedJD) =>
        set({ results, parsedJD, lastSearchTimestamp: Date.now() }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
      setActiveTab: (activeTab) => set({ activeTab }),
      setViewMode: (viewMode) => set({ viewMode }),
      setFilters: (filters) => set({ filters }),
      setFilterFormValues: (filterFormValues) => set({ filterFormValues }),
      setShowMobileFilters: (showMobileFilters) => set({ showMobileFilters }),
      reset: () =>
        set({
          jdText: "",
          parsedJD: null,
          results: [],
          activeTab: "results",
          viewMode: "list",
          filters: {},
          filterFormValues: { ...initialFilterFormValues },
          lastSearchTimestamp: null,
          loading: false,
          error: "",
        }),
    }),
    {
      name: "recruitiq-search",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        jdText: state.jdText,
        parsedJD: state.parsedJD,
        results: state.results,
        filters: state.filters,
        filterFormValues: state.filterFormValues,
        activeTab: state.activeTab,
        viewMode: state.viewMode,
        lastSearchTimestamp: state.lastSearchTimestamp,
      }),
    },
  ),
)
