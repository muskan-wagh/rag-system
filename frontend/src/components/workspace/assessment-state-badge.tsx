"use client"

import { Badge } from "@/components/ui/badge"

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "ghost"
import { ASSESSMENT_STATE_LABELS, type AssessmentState } from "@/lib/types"

/**
 * Derived assessment status badge.
 *
 * The eight states are mutually exclusive and each is backed by a real row, so
 * a badge can never claim progress that did not happen. `Failed` in particular
 * means a recorded delivery failure — never "we gave up".
 */
const VARIANT: Record<AssessmentState, BadgeVariant> = {
  not_created: "secondary",
  draft: "secondary",
  ready_to_send: "warning",
  invited: "warning",
  in_progress: "default",
  completed: "success",
  expired: "secondary",
  failed: "destructive",
}

export function AssessmentStateBadge({
  state,
  version,
  className,
}: {
  state: AssessmentState
  /** Published question version the invite/attempt is pinned to. */
  version?: number | null
  className?: string
}) {
  return (
    <Badge variant={VARIANT[state]} className={className}>
      {ASSESSMENT_STATE_LABELS[state]}
      {version != null && version > 0 ? (
        <span className="font-data text-[10px] opacity-70">v{version}</span>
      ) : null}
    </Badge>
  )
}

/**
 * Real email delivery outcome, distinct from the invite's own status.
 *
 * The link stays valid even when the email fails, which is why this is a
 * separate signal from "invited".
 */
export function DeliveryBadge({
  status,
  className,
}: {
  status: "pending" | "sent" | "failed" | null | undefined
  className?: string
}) {
  if (!status) return null
  if (status === "failed") {
    return (
      <Badge variant="destructive" className={className}>
        Email failed
      </Badge>
    )
  }
  if (status === "pending") {
    return (
      <Badge variant="secondary" className={className}>
        Sending
      </Badge>
    )
  }
  return (
    <Badge variant="success" className={className}>
      Email sent
    </Badge>
  )
}