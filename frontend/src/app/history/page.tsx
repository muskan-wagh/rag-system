"use client"

import { History } from "lucide-react"

export default function HistoryPage() {
  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary shadow-sm">
          <History className="h-3.5 w-3.5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-foreground">History</h1>
          <p className="text-xs text-muted-foreground">
            View your search and activity history
          </p>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <History className="h-10 w-10 text-muted-foreground/30 mb-4" />
        <h3 className="text-sm font-medium text-foreground mb-1">No history yet</h3>
        <p className="text-xs text-muted-foreground max-w-xs">
          Your recent candidate searches, comparisons, and activity will appear here.
        </p>
      </div>
    </div>
  )
}
