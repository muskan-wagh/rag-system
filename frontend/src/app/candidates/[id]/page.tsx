"use client"

import { useState, useCallback, useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Mail, Phone, MapPin, Briefcase, Sparkles } from "lucide-react"
import useSWR, { useSWRConfig } from "swr"
import { useApi } from "@/hooks/use-api"
import { ROUTES } from "@/lib/constants"
import type { CandidateBrief, ApiResponse } from "@/lib/types"
import {
  MatchScoreCard,
  ExecutiveSummaryCard,
  SkillCoverageCard,
  ExperienceAnalysisCard,
  EducationAnalysisCard,
  RiskAssessmentCard,
  InterviewQuestionsCard,
  ResumePreviewCard,
  RecruiterNotesCard,
  SimilarCandidatesBar,
} from "@/components/candidate-brief"
import { CandidateTimeline } from "@/components/candidate-timeline"

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "ai-brief", label: "AI Brief" },
  { id: "skills", label: "Skills" },
  { id: "experience", label: "Experience" },
  { id: "projects", label: "Projects" },
  { id: "timeline", label: "Timeline" },
  { id: "notes", label: "Notes" },
  { id: "activity", label: "Activity" },
  { id: "resume", label: "Resume" },
  { id: "parsed", label: "Parsed Data" },
]

function BriefSkeleton() {
  return (
    <div className="flex-1 mx-auto max-w-7xl px-4 md:px-6 py-8">
      <div className="h-4 w-32 bg-muted rounded mb-6 animate-pulse" />
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-white rounded-xl border border-border animate-pulse p-5">
              <div className="h-3 w-24 bg-muted rounded mb-3" />
              <div className="space-y-2">
                <div className="h-3 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-40 bg-white rounded-xl border border-border animate-pulse p-5">
              <div className="h-3 w-24 bg-muted rounded mb-3" />
              <div className="space-y-2">
                <div className="h-3 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function CandidateDetailPage() {
  const params = useParams()
  const candidateId = params.id as string
  const api = useApi()
  const { mutate } = useSWRConfig()

  const briefKey = useMemo(() => ["candidate-brief", candidateId], [candidateId])
  const { data: briefRes, error: briefError, isLoading } = useSWR<ApiResponse<CandidateBrief>>(
    briefKey,
    () => api.getCandidateBrief(candidateId),
    { revalidateOnFocus: false, revalidateOnReconnect: false, keepPreviousData: true },
  )

  const brief = briefRes?.data ?? null
  const briefErr = briefError ? "Failed to connect to server" : (!isLoading && !briefRes?.success ? (briefRes?.error || "Candidate not found") : "")

  const [activeTab, setActiveTab] = useState("overview")

  const handleAddNote = useCallback(async (text: string) => {
    await api.addCandidateNote(candidateId, text)
    mutate(briefKey)
  }, [candidateId, api, mutate, briefKey])

  if (isLoading) return <BriefSkeleton />

  if (briefErr || !brief) {
    return (
      <div className="flex-1 mx-auto max-w-5xl px-4 md:px-6 py-8">
        <Link href={ROUTES.candidateSearch}>
          <span className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Search
          </span>
        </Link>
        <div className="bg-white rounded-xl p-10 text-center border border-border">
          <p className="text-sm text-muted-foreground">{briefErr || "Candidate not found"}</p>
        </div>
      </div>
    )
  }

  const { candidate, record, parsedResume, notes, similarCandidates, scores } = brief
  const strengths = parsedResume?.strengths as string[] | undefined
  const weaknesses = parsedResume?.weaknesses as string[] | undefined
  const missingSkills = parsedResume?.missing_skills as string[] | undefined
  const workHistory = parsedResume?.work_history as Array<Record<string, unknown>> | undefined
  const projects = parsedResume?.projects as Array<Record<string, unknown>> | undefined

  return (
    <div className="flex-1 mx-auto max-w-7xl px-4 md:px-6 py-8">
      <Link href={ROUTES.candidateSearch}>
        <span className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Search
        </span>
      </Link>

      <div className="bg-white rounded-xl border border-border p-5 md:p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-start">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#1F4770]/10 ring-1 ring-border">
            <span className="text-lg font-semibold text-foreground/70">
              {candidate.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-foreground">{candidate.name}</h1>
            {record.currentTitle && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <Briefcase className="h-3.5 w-3.5" />
                {record.currentTitle}
                {record.currentCompany && <><span className="text-muted">·</span> {record.currentCompany}</>}
              </p>
            )}
            <div className="flex flex-wrap gap-2 mt-2">
              {record.email && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 rounded-lg px-2 py-1">
                  <Mail className="h-3 w-3" />
                  {record.email}
                </span>
              )}
              {record.phone && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 rounded-lg px-2 py-1">
                  <Phone className="h-3 w-3" />
                  {record.phone}
                </span>
              )}
              {record.location && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 rounded-lg px-2 py-1">
                  <MapPin className="h-3 w-3" />
                  {record.location}
                </span>
              )}
              {record.currentStatus && (
                <span className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg bg-[#1F4770]/5 text-[#1F4770] border border-[#1F4770]/10">
                  {record.currentStatus}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto mb-6 pb-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 text-xs font-medium px-3 py-2.5 border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-[#1F4770] text-[#1F4770]"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="grid gap-5 md:grid-cols-3">
          <div className="md:col-span-2 space-y-5">
            <ExecutiveSummaryCard
              summary={candidate.summary}
              recommendation="Consider"
              isLoading={false}
            />
            <SkillCoverageCard
              skills={candidate.skills}
              strengths={strengths}
              missingSkills={missingSkills}
            />
            <SimilarCandidatesBar candidates={similarCandidates} />
          </div>
          <div className="space-y-5">
            <MatchScoreCard scores={scores} />
            <ExperienceAnalysisCard
              totalYears={record.totalExperienceYears || candidate.experience}
              currentTitle={record.currentTitle}
              currentCompany={record.currentCompany}
              weaknesses={weaknesses}
            />
            <EducationAnalysisCard
              level={candidate.education.level}
              field={candidate.education.field}
            />
            <RiskAssessmentCard
              flightRisk={record.flightRisk}
              growthTrajectory={record.growthTrajectory}
            />
          </div>
        </div>
      )}

      {activeTab === "ai-brief" && (
        <div className="grid gap-5 md:grid-cols-3">
          <div className="md:col-span-2 space-y-5">
            <ExecutiveSummaryCard summary={candidate.summary} />
            <SkillCoverageCard
              skills={candidate.skills}
              strengths={strengths}
              missingSkills={missingSkills}
            />
            <InterviewQuestionsCard />
            <SimilarCandidatesBar candidates={similarCandidates} />
          </div>
          <div className="space-y-5">
            <MatchScoreCard scores={scores} />
            <RiskAssessmentCard
              flightRisk={record.flightRisk}
              growthTrajectory={record.growthTrajectory}
            />
            <ExperienceAnalysisCard
              totalYears={record.totalExperienceYears || candidate.experience}
            />
            <EducationAnalysisCard
              level={candidate.education.level}
              field={candidate.education.field}
            />
          </div>
        </div>
      )}

      {activeTab === "skills" && (
        <div className="grid gap-5 md:grid-cols-2">
          <SkillCoverageCard
            skills={candidate.skills}
            strengths={strengths}
            missingSkills={missingSkills}
          />
          <div className="bg-white rounded-xl border border-border p-5">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">All Skills</h3>
            {candidate.skills.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {candidate.skills.map((skill) => (
                  <span key={skill} className="text-xs px-2.5 py-1.5 bg-[#1F4770]/5 text-[#1F4770] rounded-lg border border-[#1F4770]/10">
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No skills listed.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === "experience" && (
        <div className="grid gap-5 md:grid-cols-2">
          <ExperienceAnalysisCard
            totalYears={record.totalExperienceYears || candidate.experience}
            currentTitle={record.currentTitle}
            currentCompany={record.currentCompany}
            weaknesses={weaknesses}
          />
          <div className="bg-white rounded-xl border border-border p-5">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Work History</h3>
            {workHistory && workHistory.length > 0 ? (
              <div className="space-y-3">
                {workHistory.map((wh, i) => (
                  <div key={i} className="border-l-2 border-border pl-3">
                    <p className="text-sm font-medium text-foreground">{String(wh.company || wh.employer || "")}</p>
                    <p className="text-xs text-muted-foreground">{String(wh.title || wh.role || wh.position || "")}</p>
                    <p className="text-xs text-muted-foreground">
                      {String(wh.duration || wh.duration_years || "")}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No work history data available.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === "projects" && (
        <div className="bg-white rounded-xl border border-border p-5">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Projects</h3>
          {projects && projects.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {projects.map((proj, i) => (
                <div key={i} className="border border-border rounded-lg p-4">
                  <p className="text-sm font-medium text-foreground">{String(proj.name || proj.title || "")}</p>
                  {proj.description ? (
                    <p className="text-xs text-muted-foreground mt-1">{String(proj.description)}</p>
                  ) : null}
                  {Array.isArray(proj.technologies) ? (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(proj.technologies as string[]).map((t: string) => (
                        <span key={t} className="text-xs px-1.5 py-0.5 bg-muted rounded">{t}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No project data available.</p>
          )}
        </div>
      )}

      {activeTab === "timeline" && (
        <div className="bg-white rounded-xl border border-border p-5">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Status Timeline</h3>
          <CandidateTimeline candidateId={candidateId} />
        </div>
      )}

      {activeTab === "notes" && (
        <RecruiterNotesCard notes={notes} onAddNote={handleAddNote} />
      )}

      {activeTab === "activity" && (
        <div className="bg-white rounded-xl border border-border p-5">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Activity</h3>
          {brief.timeline.length > 0 ? (
            <div className="space-y-2">
              {brief.timeline.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 text-sm border-b border-border last:border-0 pb-2 mb-2 last:pb-0 last:mb-0">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Sparkles className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">
                      Status changed to <span className="font-medium">{entry.status}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.changed_at).toLocaleDateString(undefined, {
                        month: "short", day: "numeric", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                      {entry.changed_by ? ` by ${entry.changed_by}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          )}
        </div>
      )}

      {activeTab === "resume" && (
        <ResumePreviewCard
          rawResumeText={record.rawResumeText}
          resumeFileUrl={record.resumeFileUrl}
        />
      )}

      {activeTab === "parsed" && (
        <div className="bg-white rounded-xl border border-border p-5">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Parsed Resume Data</h3>
          {parsedResume ? (
            <pre className="text-xs text-muted-foreground leading-relaxed overflow-x-auto bg-muted/30 rounded-lg p-4 max-h-96 overflow-y-auto">
              {JSON.stringify(parsedResume, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">No parsed resume data available.</p>
          )}
        </div>
      )}
    </div>
  )
}
