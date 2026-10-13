"use client"

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Search, Star, X, Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreRing } from "@/components/ui/score-ring";
import { StageBadge } from "@/components/ui/stage-badge";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { SearchInput } from "@/components/ui/search-input";
import { useApi } from "@/hooks/use-api";
import { stageRank } from "@/lib/pipeline";
import { ROUTES } from "@/lib/constants";
import type { WorkspaceCandidate, WorkspacePayload } from "@/lib/types";

/**
 * Stage 1 — Shortlisting.
 *
 * Eligibility for everything downstream starts here: a candidate must be
 * shortlisted ON THIS JOB to appear in the invitation queue. Passing an AI
 * screening does not shortlist anyone — that used to be the case, and it meant
 * candidates sat in an invitation queue no recruiter had ever looked at.
 */
export function ShortlistingStage({
  workspace,
  onChanged,
}: {
  workspace: WorkspacePayload
  onChanged: () => void
}) {
  const api = useApi();;
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<WorkspaceCandidate | null>(null);
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState<"queue" | "shortlisted">("queue");

  const { job, pipeline, readOnly } = workspace;

  const queue = useMemo(
    () =>
      pipeline
        .filter((row) => stageRank(row.stage) <= stageRank("Shortlisted"))
        .filter((row) =>
          search
            ? `${row.fullName} ${row.email} ${row.currentTitle} ${row.currentCompany}`
                .toLowerCase()
                .includes(search.toLowerCase())
            : true,
        ),
    [pipeline, search],
  );

  const shortlisted = useMemo(
    () => pipeline.filter((row) => row.stage === "Shortlisted"),
    [pipeline],
  );

  const rows = filter === "shortlisted" ? shortlisted : queue;

  async function shortlist(row: WorkspaceCandidate) {
    if (readOnly) {
      toast.error(`"${job.title}" is closed. Reopen it to shortlist candidates.`);
      return;
    }
    setBusy(row.candidateId);
    try {
      const res = await api.shortlist(job.id, row.candidateId, note || undefined);
      if (!res.success) throw new Error(res.error || "Could not shortlist candidate");

      const data = res.data as { changed: boolean; deduplicated: boolean; message: string; usedOverride: boolean; screeningScore: number | null };
      if (data.deduplicated && !data.changed) {
        toast.message("Already shortlisted", { description: data.message });
      } else {
        toast.success("Candidate shortlisted", {
          description:
            data.screeningScore != null
              ? `Screening score ${data.screeningScore}/100. They are now eligible for this job's assessment.`
              : "No screening score on file. They are now eligible for this job's assessment.",
        });
      }
      setConfirm(null);
      setNote("");
      onChanged();
    } catch (err) {
      toast.error("Could not shortlist", {
        description: err instanceof Error ? err.message : "Unexpected error",
      });
    } finally {
      setBusy(null);
    }
  }

  async function unshortlist(row: WorkspaceCandidate) {
    if (readOnly) {
      toast.error(`"${job.title}" is closed. Reopen it to change shortlists.`);
      return;
    }
    setBusy(row.candidateId);
    try {
      const res = await api.unshortlist(job.id, row.candidateId, "Reversed from the workspace");
      if (!res.success) throw new Error(res.error || "Could not reverse the shortlist");
      toast.success("Shortlist reversed", {
        description: `${row.fullName} is back in Screening. The original decision is kept in their history.`,
      });
      onChanged();
    } catch (err) {
      toast.error("Could not reverse shortlist", {
        description: err instanceof Error ? err.message : "Unexpected error",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-full bg-surface-secondary p-1">
          <FilterPill
            active={filter === "queue"}
            onClick={() => setFilter("queue")}
            label={`Review queue (${queue.length})`}
          />
          <FilterPill
            active={filter === "shortlisted"}
            onClick={() => setFilter("shortlisted")}
            label={`Shortlisted (${shortlisted.length})`}
          />
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search candidates…"
          className="max-w-xs"
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Search}
          title={filter === "shortlisted" ? "Nobody shortlisted yet" : "Nobody to review"}
          description={
            filter === "shortlisted"
              ? "Shortlist a candidate from the review queue and they become eligible for this job's assessment."
              : "Upload resumes or enrol candidates against this job to start reviewing them here."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-[0.06em] text-faint">
                <th scope="col" className="px-4 py-2.5 font-medium">Candidate</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Screening</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Stage</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.applicationId} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`${ROUTES.candidateDetail(row.candidateId)}?job=${job.id}`}
                      className="text-[13px] font-medium text-ink hover:underline"
                    >
                      {row.fullName || "Unnamed candidate"}
                    </Link>
                    <p className="mt-0.5 text-[11.5px] text-faint">
                      {[row.currentTitle, row.currentCompany].filter(Boolean).join(" · ") || row.email}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {row.screening ? (
                      <div className="flex items-center gap-2">
                        <ScoreRing value={row.screening.overall} size={36} />
                        <div>
                          <span className="text-[12px] capitalize text-ink">{row.screening.status}</span>
                          {row.screening.overridden && (
                            <Badge variant="warning" className="ml-1.5">Override</Badge>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[12px] text-faint">Not screened</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StageBadge stage={row.stage} showDot />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.stage === "Shortlisted" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2.5 text-xs"
                        disabled={readOnly || busy === row.candidateId}
                        onClick={() => unshortlist(row)}
                      >
                        {busy === row.candidateId ? (
                          <Loader2 size={13} className="animate-spin" aria-hidden />
                        ) : (
                          <X size={13} aria-hidden />
                        )}
                        Un-shortlist
                      </Button>
                    ) : (
                      <Button
                        variant="action"
                        size="sm"
                        className="h-8 px-2.5 text-xs"
                        disabled={readOnly || busy === row.candidateId}
                        onClick={() => {
                          setConfirm(row)
                          setNote("")
                        }}
                      >
                        {busy === row.candidateId ? (
                          <Loader2 size={13} className="animate-spin" aria-hidden />
                        ) : (
                          <Star size={13} aria-hidden />
                        )}
                        Shortlist
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null)
        }}
      >
        <DialogContent className="max-w-md">
          <div className="px-6 pt-6">
            <h2 className="text-[16px] font-medium text-ink">
              Shortlist {confirm?.fullName} for {job.title}?
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              This applies to{" "}
              <strong className="text-ink">this job only</strong>. Any other role they are
              applying for is unaffected.
              {confirm?.screening?.status === 'failed' && (
                <>
                  {" "}Their screening result is{" "}
                  <strong className="text-ink">failed ({confirm.screening.overall}/100)</strong> —
                  shortlisting here is recorded as your override.
                </>
              )}
            </p>
            <div className="mt-4">
              <label htmlFor="shortlist-note" className="text-[12px] font-medium text-ink">
                Note <span className="font-normal text-faint">(optional, kept in their history)</span>
              </label>
              <Textarea
                id="shortlist-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Why are you advancing this person?"
                className="mt-1.5"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 px-6 pb-6 pt-4">
            <Button variant="ghost" size="sm" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="action"
              size="sm"
              disabled={busy === confirm?.candidateId}
              onClick={() => confirm && shortlist(confirm)}
            >
              {busy === confirm?.candidateId && <Loader2 size={13} className="animate-spin" aria-hidden />}
              <Play size={13} aria-hidden />
              Shortlist
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FilterPill({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "rounded-full bg-surface px-3.5 py-1.5 text-[12px] font-medium text-ink shadow-xs"
          : "rounded-full px-3.5 py-1.5 text-[12px] font-medium text-muted transition-colors duration-120 hover:text-ink"
      }
    >
      {label}
    </button>
  )
}

/** Loading placeholder shared by the workspace stages. */
export function StageSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  )
}

export { Input }