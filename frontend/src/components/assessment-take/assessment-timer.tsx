"use client"
/* eslint-disable react-hooks/set-state-in-effect -- countdown interval syncs display with wall clock */

import { useEffect, useState } from "react"

/** Countdown timer — display only; expiry is enforced server-side. */
export function AssessmentTimer({ expiresAt }: { expiresAt: string | null }) {
  const [remaining, setRemaining] = useState<string>(() => (expiresAt ? "—" : "No time limit"));

  useEffect(() => {
    if (!expiresAt) {
      setRemaining("No time limit");
      return;
    }
    function tick() {
      const ms = new Date(expiresAt as string).getTime() - Date.now();
      if (ms <= 0) {
        setRemaining("Time expired — submit now");
        return;
      }
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setRemaining(`${m}:${String(s).padStart(2, "0")} remaining`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return (
    <span className="rounded-full border border-border px-3 py-1 text-xs tabular-nums" data-testid="assessment-timer">
      {remaining}
    </span>
  );
}
