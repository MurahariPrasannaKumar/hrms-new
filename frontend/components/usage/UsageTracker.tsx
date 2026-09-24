"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usageApi } from "@/lib/api/usage";
import { useAuth } from "@/lib/auth";

/** No mouse, key, scroll or touch for this long counts as idle and pauses the timer. */
const IDLE_MS = 2 * 60_000;
const FLUSH_MS = 15_000;
const OWNER_KEY = "edusphere.usage.owner";
const OWNER_TTL_MS = 4_000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel"] as const;

export type UsageState = "running" | "hidden" | "idle" | "other-tab";
interface UsageValue { seconds: number; state: UsageState; tracking: boolean }

const UsageContext = createContext<UsageValue>({ seconds: 0, state: "hidden", tracking: false });
export const useUsage = () => useContext(UsageContext);

const tabId = () => Math.random().toString(36).slice(2);

/**
 * Counts the seconds a student or teacher actively spends in EduSphere today.
 * Runs while this tab is visible and the user is active; pauses when the tab is hidden or closed and
 * continues from the saved total (kept on the server) when they come back. Only one tab counts at a time.
 */
export function UsageTrackerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const tracking = user?.role === "STUDENT" || user?.role === "TEACHER";
  const [seconds, setSeconds] = useState(0);
  const [state, setState] = useState<UsageState>("running");
  const pending = useRef(0);
  const lastActivity = useRef(Date.now());
  const id = useRef(tabId());
  const flushing = useRef(false);
  const secondsRef = useRef(0);
  secondsRef.current = seconds;

  const flush = useCallback(async () => {
    if (flushing.current || pending.current <= 0) return;
    const sending = Math.min(pending.current, 60);
    pending.current -= sending;
    flushing.current = true;
    try {
      const res = await usageApi.heartbeat(sending);
      setSeconds((s) => Math.max(s, res.seconds));
    } catch {
      pending.current += sending; // retry with the next beat
    } finally {
      flushing.current = false;
    }
  }, []);

  useEffect(() => {
    if (!tracking) return;
    let cancelled = false;
    const load = () => usageApi.today().then((r) => { if (!cancelled) setSeconds((s) => Math.max(s, r.seconds)); }).catch(() => undefined);
    load();

    const onActivity = () => { lastActivity.current = Date.now(); };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    const owns = () => {
      try {
        const raw = localStorage.getItem(OWNER_KEY);
        const [owner, ts] = raw ? raw.split("|") : [];
        if (!owner || owner === id.current || Date.now() - Number(ts) > OWNER_TTL_MS) {
          localStorage.setItem(OWNER_KEY, `${id.current}|${Date.now()}`);
          return true;
        }
        return false;
      } catch {
        return true; // storage blocked: fall back to counting in this tab
      }
    };

    const tick = setInterval(() => {
      if (document.visibilityState !== "visible") return setState("hidden");
      if (Date.now() - lastActivity.current > IDLE_MS) return setState("idle");
      if (!owns()) return setState("other-tab");
      setState("running");
      pending.current += 1;
      setSeconds((s) => s + 1);
    }, 1000);
    const beat = setInterval(flush, FLUSH_MS);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        void flush();
      } else {
        lastActivity.current = Date.now();
        load(); // pick up time another tab counted meanwhile
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);

    return () => {
      cancelled = true;
      clearInterval(tick);
      clearInterval(beat);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      void flush();
    };
  }, [tracking, flush]);

  // Unlock (or refresh) the attendance card the moment the student crosses the required time.
  useEffect(() => {
    if (!tracking || seconds === 0 || seconds % 60 !== 0) return;
    // Send what we counted first so the server total is current before the attendance state is refetched.
    void flush().then(() => qc.invalidateQueries({ queryKey: ["attendance", "me"] }));
  }, [seconds, tracking, qc, flush]);

  const value = useMemo<UsageValue>(() => ({ seconds, state, tracking }), [seconds, state, tracking]);
  return <UsageContext.Provider value={value}>{children}</UsageContext.Provider>;
}

export const formatClock = (total: number) => {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
};
