"use client"

import { useEffect, useState } from "react"
import { candidateApi } from "@/lib/candidate-api"
import { CodingEditor } from "@/components/assessment-take/coding-editor"
import { HiringProgressTracker } from "@/components/hiring-progress-tracker"

/**
 * Secure interview waiting room + shared coding environment.
 * Video stays external via meeting_link (provider-agnostic).
 * No private notes / evaluations / hidden scores are ever fetched here.
 */
export function InterviewJoinView({ token, expectedStage }: { token: string; expectedStage: string }) {
  const [info, setInfo] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("// Shared scratchpad — your interviewer can see this file.\n");
  const [stages, setStages] = useState<Array<{ stage: string; state: "completed" | "current" | "upcoming" }>>([]);

  useEffect(() => {
    candidateApi
      .exchangeInterviewToken(token)
      .then((r) => setInfo(r as unknown as Record<string, unknown>))
      .catch((e) => setError(e instanceof Error ? e.message : "Invalid interview link."));
    candidateApi.getProgress().then((p) => setStages(p.stages as typeof stages)).catch(() => {});
  }, [token]);

  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-xl font-semibold">{expectedStage}</h1>
        <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>
      </main>
    );
  }
  if (!info) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-sm text-muted-foreground">Validating your secure interview link…</p>
      </main>
    );
  }

  const meetingLink = String(info.meeting_link || "");
  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <h1 className="text-xl font-semibold">{String(info.stage || expectedStage)}</h1>
      <p className="text-sm text-muted-foreground">
        {String(info.scheduled_date || "")} {String(info.scheduled_time || "")} · {String(info.interview_type || "online")}
      </p>

      {stages.length > 0 ? <HiringProgressTracker stages={stages} variant="candidate" /> : null}

      <div className="rounded-xl border border-border p-4">
        <h2 className="mb-2 text-sm font-medium">Waiting room</h2>
        <p className="text-sm text-muted-foreground">
          Your interviewer will join shortly. Keep this page open. When it&apos;s time, join via the meeting link below.
        </p>
        {meetingLink ? (
          <a
            href={meetingLink}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Join meeting
          </a>
        ) : (
          <p className="mt-3 text-sm">Meeting link will appear here once your recruiter adds it.</p>
        )}
      </div>

      <div className="rounded-xl border border-border p-4">
        <h2 className="mb-2 text-sm font-medium">Shared coding environment</h2>
        <p className="mb-2 text-xs text-muted-foreground">Write and discuss code live with your interviewer (JavaScript).</p>
        <CodingEditor value={code} onChange={setCode} language="javascript" height={280} />
      </div>
    </main>
  );
}
