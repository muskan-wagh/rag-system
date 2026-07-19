"use client"

import { FileText, ExternalLink } from "lucide-react"

interface ResumePreviewCardProps {
  rawResumeText?: string
  resumeFileUrl?: string
}

export function ResumePreviewCard({ rawResumeText, resumeFileUrl }: ResumePreviewCardProps) {
  if (!rawResumeText && !resumeFileUrl) {
    return (
      <div className="bg-white rounded-xl border border-border p-5">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="h-4 w-4 text-[#1F4770]" />
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Resume</h3>
        </div>
        <p className="text-sm text-muted-foreground">No resume data available.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-[#1F4770]" />
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Resume</h3>
        </div>
        {resumeFileUrl && (
          <a
            href={resumeFileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-[#1F4770] hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Open file
          </a>
        )}
      </div>

      {rawResumeText && (
        <div className="max-h-60 overflow-y-auto text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap font-mono bg-muted/30 rounded-lg p-3">
          {rawResumeText}
        </div>
      )}
    </div>
  )
}
