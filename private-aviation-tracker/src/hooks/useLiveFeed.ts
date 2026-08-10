"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FilterKey, LiveFeedResult } from "@/lib/types";

/**
 * Subscribes to the live aircraft feed for a viewport.
 *
 * Prefers the SSE stream and falls back to interval polling if the stream
 * cannot be established (proxies that buffer SSE, for example). The viewport
 * is quantised before it reaches the server so panning the map does not
 * reopen the connection on every frame.
 */

export interface FeedViewport {
  lat: number;
  lon: number;
  radiusNm: number;
}

export interface LiveFeedState {
  data: LiveFeedResult | null;
  error: string | null;
  errorDetail: string | null;
  connected: boolean;
  transport: "stream" | "poll" | "idle";
  refresh: () => void;
}

const POLL_INTERVAL_MS = Number(process.env.NEXT_PUBLIC_MAP_REFRESH_MS ?? 5000);

function quantise(viewport: FeedViewport) {
  return {
    lat: Math.round(viewport.lat * 4) / 4,
    lon: Math.round(viewport.lon * 4) / 4,
    radiusNm: Math.min(250, Math.max(25, Math.ceil(viewport.radiusNm / 25) * 25)),
  };
}

export function useLiveFeed(
  viewport: FeedViewport | null,
  filters: FilterKey[],
): LiveFeedState {
  const [data, setData] = useState<LiveFeedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [transport, setTransport] = useState<"stream" | "poll" | "idle">("idle");
  const [nonce, setNonce] = useState(0);

  const filterKey = useMemo(() => [...filters].sort().join(","), [filters]);
  const cell = viewport ? quantise(viewport) : null;
  const cellKey = cell ? `${cell.lat}:${cell.lon}:${cell.radiusNm}` : null;

  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!cellKey || !cell) return;

    const query = `lat=${cell.lat}&lon=${cell.lon}&radius=${cell.radiusNm}&filters=${encodeURIComponent(filterKey)}`;
    let cancelled = false;
    let source: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const applyError = async (response: Response) => {
      let message = "Live aircraft data temporarily unavailable.";
      let detail: string | null = null;
      try {
        const body = await response.json();
        message = body.message ?? message;
        detail = body.detail ?? null;
      } catch {
        /* non-JSON error body */
      }
      if (!cancelled) {
        setError(message);
        setErrorDetail(detail);
        setConnected(false);
      }
    };

    const poll = async () => {
      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;
      try {
        const response = await fetch(`/api/aircraft/live?${query}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) {
          await applyError(response);
          return;
        }
        const body = (await response.json()) as LiveFeedResult;
        if (cancelled) return;
        setData(body);
        setConnected(true);
        setError(body.error ?? null);
        setErrorDetail(null);
      } catch (err) {
        if ((err as Error).name === "AbortError" || cancelled) return;
        setError("Live aircraft data temporarily unavailable.");
        setErrorDetail((err as Error).message);
        setConnected(false);
      }
    };

    const startPolling = () => {
      if (cancelled || pollTimer) return;
      setTransport("poll");
      void poll();
      pollTimer = setInterval(poll, POLL_INTERVAL_MS);
    };

    const startStream = () => {
      if (typeof EventSource === "undefined") {
        startPolling();
        return;
      }

      setTransport("stream");
      source = new EventSource(`/api/aircraft/stream?${query}`);

      // A server that closes the stream on purpose (serverless function
      // duration caps) is not a failure — EventSource reconnects by itself.
      let rotating = false;
      let failuresWithoutData = 0;

      source.addEventListener("aircraft", (event) => {
        if (cancelled) return;
        try {
          const body = JSON.parse((event as MessageEvent).data) as LiveFeedResult;
          setData(body);
          setConnected(true);
          setError(body.error ?? null);
          setErrorDetail(null);
          failuresWithoutData = 0;
        } catch {
          /* ignore malformed frame */
        }
      });

      source.addEventListener("rotate", () => {
        rotating = true;
      });

      source.addEventListener("error", (event) => {
        const message = (event as MessageEvent).data;
        if (typeof message === "string" && message.length > 0) {
          try {
            const body = JSON.parse(message);
            setError(body.message ?? "Live aircraft data temporarily unavailable.");
            setErrorDetail(body.detail ?? null);
          } catch {
            /* ignore */
          }
          return;
        }

        if (rotating) {
          // Announced hand-off: let the browser reconnect and keep streaming.
          rotating = false;
          return;
        }

        // A non-200 response (e.g. 503 when ADS-B credentials are missing)
        // makes EventSource "fail the connection": it errors once and never
        // retries, leaving readyState CLOSED. Waiting for further errors there
        // would hang forever and hide the reason from the user, so switch to
        // polling immediately — that path reads the JSON error body.
        const givenUp = !source || source.readyState === EventSource.CLOSED;

        // Otherwise the browser is reconnecting on its own; allow a couple of
        // attempts before abandoning the stream for this viewport.
        if (!givenUp) {
          failuresWithoutData += 1;
          if (failuresWithoutData < 3) return;
        }

        setConnected(false);
        source?.close();
        source = null;
        startPolling();
      });
    };

    startStream();

    return () => {
      cancelled = true;
      source?.close();
      abortRef.current?.abort();
      if (pollTimer) clearInterval(pollTimer);
    };
    // `cell` is derived from cellKey; depending on the key avoids reconnect churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cellKey, filterKey, nonce]);

  return { data, error, errorDetail, connected, transport, refresh };
}
