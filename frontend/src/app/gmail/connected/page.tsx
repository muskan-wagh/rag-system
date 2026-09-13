"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

function GmailConnectedContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status] = useState(() => searchParams.get("ok") === "1" ? "ok" as const : "failed" as const)
  const reason = searchParams.get("reason") || ""
  const isPopup = typeof window !== "undefined" && window.opener != null

  useEffect(() => {
    try {
      window.opener?.postMessage(
        { type: "hirestack-gmail-connected", ok: status === "ok", reason },
        window.location.origin,
      )
    } catch {
      // Cross-origin opener — the profile page polling fallback will pick up the connection.
    }
    if (isPopup && status === "ok") {
      const t = setTimeout(() => window.close(), 1200)
      return () => clearTimeout(t)
    }
  }, [status, reason, isPopup])

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 text-center">
        {status === "ok" ? (
          <>
            <CheckCircle2 className="h-10 w-10 text-success mx-auto mb-3" />
            <h1 className="text-[15px] font-medium text-ink">Gmail connected</h1>
            <p className="text-[13px] text-muted mt-1">
              {isPopup
                ? "You can close this window — your candidate page has been updated."
                : "Return to the candidate profile to send outreach."}
            </p>
          </>
        ) : (
          <>
            <AlertCircle className="h-10 w-10 text-danger mx-auto mb-3" />
            <h1 className="text-[15px] font-medium text-ink">Gmail connection failed</h1>
            <p className="text-[13px] text-muted mt-1">
              {reason ? `Reason: ${reason}. ` : ""}Please try connecting again.
            </p>
          </>
        )}
        <div className="mt-5 flex items-center justify-center gap-2">
          {isPopup ? (
            <Button size="sm" onClick={() => window.close()}>Close window</Button>
          ) : (
            <Button size="sm" onClick={() => router.push("/candidates")}>Back to candidates</Button>
          )}
        </div>
        {isPopup && status === "ok" && (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-faint">
            <Loader2 className="h-3 w-3 animate-spin" /> Closing automatically…
          </p>
        )}
      </div>
    </div>
  )
}

export default function GmailConnectedPage() {
  return (
    <Suspense fallback={null}>
      <GmailConnectedContent />
    </Suspense>
  )
}
