"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export type ScrapeRunStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

interface ScrapeRunState {
  status: ScrapeRunStatus | null;
  leadsFound: number;
  isPolling: boolean;
  error: string | null;
  isUsingSSE?: boolean;
}

/**
 * React hook that connects to a single ScrapeRun status by ID using Server-Sent Events (SSE),
 * with automatic fallback to HTTP polling if SSE is not supported or encounters an error.
 *
 * - Attempts to stream status from GET /api/scrape-runs/[runId]/sse
 * - If unsupported or error occurs, falls back to polling GET /api/scrape-runs/[runId] every intervalMs
 * - Automatically stops when status reaches COMPLETED or FAILED
 * - Returns { status, leadsFound, isPolling, error, isUsingSSE }
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
    isUsingSSE: false,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const runIdRef = useRef(runId);
  const statusRef = useRef<ScrapeRunStatus | null>(null);

  // Keep the ref current to avoid stale closures
  runIdRef.current = runId;

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const stopSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  // Standard fallback HTTP polling fetch
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

      statusRef.current = run.status as ScrapeRunStatus;

      setState({
        status: run.status as ScrapeRunStatus,
        leadsFound: run.leadsFound ?? 0,
        isPolling: run.status !== "COMPLETED" && run.status !== "FAILED",
        error: null,
        isUsingSSE: false,
      });

      if (run.status === "COMPLETED" || run.status === "FAILED") {
        stopPolling();
      }
    } catch (err: any) {
      console.error("[useScrapeRunStatus] Poll error:", err?.message);
      setState((prev) => ({
        ...prev,
        error: err?.message || "Failed to fetch status",
      }));
    }
  }, [stopPolling]);

  // Start the standard HTTP polling interval as fallback
  const startPollingFallback = useCallback(() => {
    stopSSE();
    stopPolling();

    const id = runIdRef.current;
    if (!id) return;

    console.info(`[useScrapeRunStatus] Starting HTTP polling fallback for run: ${id}`);
    
    setState((prev) => ({ 
      ...prev, 
      isPolling: true, 
      isUsingSSE: false 
    }));

    // Immediate first fetch
    fetchStatus();

    // Poll at interval
    intervalRef.current = setInterval(fetchStatus, intervalMs);
  }, [fetchStatus, intervalMs, stopPolling, stopSSE]);

  useEffect(() => {
    // Cleanup any existing connections/intervals
    stopPolling();
    stopSSE();

    statusRef.current = null;

    if (!runId) {
      setState({ status: null, leadsFound: 0, isPolling: false, error: null, isUsingSSE: false });
      return;
    }

    // Try EventSource/SSE first
    if (typeof window !== "undefined" && window.EventSource) {
      console.info(`[useScrapeRunStatus] Attempting SSE connection for run: ${runId}`);
      
      setState({ 
        status: "PENDING", 
        leadsFound: 0, 
        isPolling: true, 
        error: null, 
        isUsingSSE: true 
      });

      const es = new EventSource(`/api/scrape-runs/${runId}/sse`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const run = data.run;

          if (run) {
            statusRef.current = run.status as ScrapeRunStatus;
            setState({
              status: run.status as ScrapeRunStatus,
              leadsFound: run.leadsFound ?? 0,
              isPolling: run.status !== "COMPLETED" && run.status !== "FAILED",
              error: data.error || null,
              isUsingSSE: true,
            });

            if (run.status === "COMPLETED" || run.status === "FAILED") {
              console.info(`[useScrapeRunStatus] SSE reached terminal state (${run.status}). Closing connection.`);
              es.close();
            }
          }
        } catch (err) {
          console.error("[useScrapeRunStatus] Error parsing SSE message payload:", err);
        }
      };

      es.onerror = (err) => {
        if (statusRef.current === "COMPLETED" || statusRef.current === "FAILED") {
          return;
        }
        console.warn("[useScrapeRunStatus] SSE stream error. Falling back to HTTP polling.", err);
        startPollingFallback();
      };
    } else {
      console.warn("[useScrapeRunStatus] EventSource is not supported. Falling back to HTTP polling.");
      startPollingFallback();
    }

    return () => {
      stopPolling();
      stopSSE();
    };
  }, [runId, intervalMs, startPollingFallback, stopPolling, stopSSE]);

  return state;
}

