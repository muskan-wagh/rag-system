"use client"

import { MessageSquare, Beaker, Users } from "lucide-react"

interface InterviewQuestionsCardProps {
  technical?: string[]
  behavioral?: string[]
  followUpTopics?: string[]
}

export function InterviewQuestionsCard({ technical = [], behavioral = [], followUpTopics = [] }: InterviewQuestionsCardProps) {
  const hasContent = technical.length > 0 || behavioral.length > 0 || followUpTopics.length > 0

  if (!hasContent) {
    return (
      <div className="bg-white rounded-xl border border-border p-5">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="h-4 w-4 text-[#1F4770]" />
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Interview Questions</h3>
        </div>
        <p className="text-sm text-muted-foreground">Generate an AI hiring brief for suggested questions.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="h-4 w-4 text-[#1F4770]" />
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Interview Questions</h3>
      </div>

      <div className="space-y-4">
        {technical.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground mb-2">
              <Beaker className="h-3.5 w-3.5 text-[#1F4770]" />
              Technical
            </div>
            <ul className="space-y-1.5">
              {technical.map((q, i) => (
                <li key={i} className="text-xs text-muted-foreground pl-5 border-l-2 border-[#1F4770]/20">
                  {q}
                </li>
              ))}
            </ul>
          </div>
        )}

        {behavioral.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground mb-2">
              <Users className="h-3.5 w-3.5 text-amber-500" />
              Behavioral
            </div>
            <ul className="space-y-1.5">
              {behavioral.map((q, i) => (
                <li key={i} className="text-xs text-muted-foreground pl-5 border-l-2 border-amber-200">
                  {q}
                </li>
              ))}
            </ul>
          </div>
        )}

        {followUpTopics.length > 0 && (
          <div className="border-t border-border pt-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Follow-up Topics</p>
            <div className="flex flex-wrap gap-1.5">
              {followUpTopics.map((topic, i) => (
                <span key={i} className="text-xs px-2 py-1 bg-muted rounded-md text-muted-foreground">
                  {topic}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
