"use client"

import { useState } from "react"
import { StickyNote, Plus, Loader2 } from "lucide-react"
import type { CandidateBriefNote } from "@/lib/types"

interface RecruiterNotesCardProps {
  notes: CandidateBriefNote[]
  onAddNote: (text: string) => Promise<void>
}

export function RecruiterNotesCard({ notes, onAddNote }: RecruiterNotesCardProps) {
  const [newNote, setNewNote] = useState("")
  const [adding, setAdding] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newNote.trim() || adding) return
    setAdding(true)
    try {
      await onAddNote(newNote.trim())
      setNewNote("")
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <div className="flex items-center gap-2 mb-3">
        <StickyNote className="h-4 w-4 text-[#1F4770]" />
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</h3>
        <span className="text-xs text-muted-foreground ml-auto">{notes.length} notes</span>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <input
          type="text"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a note..."
          className="flex-1 text-sm px-3 py-2 rounded-lg border border-border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-[#1F4770]/20 focus:border-[#1F4770]"
        />
        <button
          type="submit"
          disabled={!newNote.trim() || adding}
          className="flex items-center gap-1 text-sm px-3 py-2 bg-[#1F4770] text-white rounded-lg hover:bg-[#1F4770]/90 disabled:opacity-50"
        >
          {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        </button>
      </form>

      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {notes.map((note) => (
            <div key={note.id} className="text-sm bg-muted/30 rounded-lg p-3">
              <p className="text-foreground">{note.note_text}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(note.created_at).toLocaleDateString(undefined, {
                  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
