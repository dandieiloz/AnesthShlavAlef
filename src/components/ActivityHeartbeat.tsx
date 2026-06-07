"use client";

import { useEffect } from "react";

// Min interval between client-side pings, to avoid hammering the server with
// duplicate POSTs from rapid visibility toggles or short SPA navigations.
// The server independently throttles writes to the DB at 5 minutes.
const MIN_CLIENT_INTERVAL_MS = 60 * 1000;

let lastPingAt = 0;

function ping() {
  const now = Date.now();
  if (now - lastPingAt < MIN_CLIENT_INTERVAL_MS) return;
  lastPingAt = now;
  fetch("/api/activity/ping", { method: "POST", credentials: "same-origin", keepalive: true }).catch(() => {
    // best-effort: a missed heartbeat is fine, the next one will catch up
    lastPingAt = 0;
  });
}

export function ActivityHeartbeat() {
  useEffect(() => {
    ping();
    const onVisibility = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", ping);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", ping);
    };
  }, []);
  return null;
}
