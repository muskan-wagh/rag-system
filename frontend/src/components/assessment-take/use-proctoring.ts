"use client"

import { useEffect, useRef } from "react"
import { candidateApi } from "@/lib/candidate-api"

/**
 * Proctoring signal foundation — observable events only.
 * Never claims cheating. Batched, best-effort, silent failures.
 */

const EVENT_ALIASES: Record<string, string> = {
  TAB_SWITCH: "TAB_SWITCH",
  FULLSCREEN_EXIT: "FULLSCREEN_EXIT",
  COPY: "COPY",
  PASTE: "PASTE",
  CAMERA_DISABLED: "CAMERA_DISABLED",
  MIC_DISABLED: "MIC_DISABLED",
  NETWORK_DISCONNECTED: "NETWORK_DISCONNECTED",
  NETWORK_RECONNECTED: "NETWORK_RECONNECTED",
};

export function useProctoring(attemptId: string | null) {
  const attemptRef = useRef<string | null>(null);

  useEffect(() => {
    attemptRef.current = attemptId;
  }, [attemptId]);

  useEffect(() => {
    if (!attemptId) return;
    const queue: Array<{ type: string; meta: Record<string, unknown> }> = [];
    let timer: ReturnType<typeof setTimeout> | null = null;

    function flush() {
      const id = attemptRef.current;
      if (!id || queue.length === 0) return;
      const batch = queue.splice(0, queue.length);
      for (const e of batch) {
        candidateApi.logProctoring(id, e.type, e.meta).catch(() => {});
      }
    }

    function push(type: string, meta: Record<string, unknown> = {}) {
      if (!EVENT_ALIASES[type]) return;
      queue.push({ type, meta });
      if (!timer) {
        timer = setTimeout(() => {
          timer = null;
          flush();
        }, 3000);
      }
    }

    const onVisibility = () => {
      if (document.hidden) push("TAB_SWITCH", { reason: "visibilitychange" });
    };
    const onBlur = () => push("TAB_SWITCH", { reason: "blur" });
    const onFullscreen = () => {
      if (!document.fullscreenElement) push("FULLSCREEN_EXIT", {});
    };
    const onCopy = () => push("COPY", {});
    const onPaste = () => push("PASTE", {});
    const onOffline = () => push("NETWORK_DISCONNECTED", {});
    const onOnline = () => push("NETWORK_RECONNECTED", {});

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFullscreen);
    document.addEventListener("copy", onCopy);
    document.addEventListener("paste", onPaste);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);

    // Camera/mic permission state (no recording, no stream capture).
    try {
      const nav = navigator as Navigator & {
        permissions?: { query: (d: { name: string }) => Promise<{ state: string }> };
      };
      nav.permissions?.query({ name: "camera" as PermissionName }).then((s) => {
        if (s.state === "denied") push("CAMERA_DISABLED", { state: s.state });
      }).catch(() => {});
      nav.permissions?.query({ name: "microphone" as PermissionName }).then((s) => {
        if (s.state === "denied") push("MIC_DISABLED", { state: s.state });
      }).catch(() => {});
    } catch {
      // best-effort only
    }

    const interval = setInterval(flush, 15000);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFullscreen);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("paste", onPaste);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      clearInterval(interval);
      if (timer) clearTimeout(timer);
      flush();
    };
  }, [attemptId]);
}
