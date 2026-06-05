"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export type ScrapeRunStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

interface ScrapeRunState {
  status: ScrapeRunStatus | null;
  leadsFound: number;
  isPolling: boolean;
  error: string | null;
}

/**
 * React hook that polls a single ScrapeRun status by ID.
 *
 * - Polls GET /api/scrape-runs/[runId] at `intervalMs` (default 5s)
 * - Automatically stops when status reaches COMPLETED or FAILED
 * - Returns { status, leadsFound, isPolling, error }
 *
 * Usage:
 *   const { status, leadsFound, isPolling } = useScrapeRunStatus(runId);
 */
export function useScrapeRunStatus(
  runId: string | null,
  intervalMs: number = 5000
): ScrapeRunState {
  const [state, setState] = useState<ScrapeRunState>({
    status: null,
    leadsFound: 0,
    isPolling: false,
    error: null,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runIdRef = useRef(runId);

  // Keep the ref current to avoid stale closures
  runIdRef.current = runId;

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setState((prev) => ({ ...prev, isPolling: false }));
  }, []);

  const fetchStatus = useCallback(async () => {
    const id = runIdRef.current;
    if (!id) return;

    try {
      const res = await fetch(`/api/scrape-runs/${id}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const run = data.run;

      setState({
        status: run.status as ScrapeRunStatus,
        leadsFound: run.leadsFound ?? 0,
        isPolling: run.status !== "COMPLETED" && run.status !== "FAILED",
        error: null,
      });

      // Stop polling on terminal state
      if (run.status === "COMPLETED" || run.status === "FAILED") {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    } catch (err: any) {
      console.error("[useScrapeRunStatus] Poll error:", err?.message);
      setState((prev) => ({
        ...prev,
        error: err?.message || "Failed to fetch status",
      }));
      // Don't stop polling on transient network errors — retry on next tick
    }
  }, []);

  useEffect(() => {
    // Cleanup any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!runId) {
      setState({ status: null, leadsFound: 0, isPolling: false, error: null });
      return;
    }

    // Start polling
    setState((prev) => ({ ...prev, isPolling: true, error: null }));

    // Immediate first fetch
    fetchStatus();

    // Then poll at interval
    intervalRef.current = setInterval(fetchStatus, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [runId, intervalMs, fetchStatus]);

  return state;
}
