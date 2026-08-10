import type { NextRequest } from "next/server";
import { jsonError, parseFilters, parseViewport } from "@/lib/api";
import { adsbConfigurationHint, adsbConfigured, config } from "@/lib/config";
import { getViewportAircraft } from "@/lib/live/feedManager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Serverless function ceiling; the stream rotates before reaching it. */
export const maxDuration = 60;

/**
 * GET /api/aircraft/stream?lat=&lon=&radius=&filters=
 *
 * Server-sent events carrying the same payload as /api/aircraft/live, pushed
 * on the poll interval. Every connected client for a given viewport cell reads
 * from one shared upstream poll, so adding viewers costs no extra ADS-B calls.
 *
 * The connection is closed deliberately after `ADSB_STREAM_LIFETIME_MS` with a
 * `rotate` event. EventSource reconnects on its own, and the client treats an
 * announced rotation as normal rather than as a transport failure — which is
 * what makes this work unchanged on a platform that caps function duration.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  if (!adsbConfigured()) {
    return jsonError(
      "adsb_not_configured",
      "Live aircraft data temporarily unavailable.",
      503,
      adsbConfigurationHint(),
    );
  }

  const viewport = parseViewport(params);
  if ("error" in viewport) {
    return jsonError("invalid_request", viewport.error, 400);
  }

  const filters = parseFilters(params.get("filters"));
  const encoder = new TextEncoder();
  const intervalMs = Math.max(2000, config.adsb.pollIntervalMs);

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let rotation: ReturnType<typeof setTimeout> | null = null;

      const close = () => {
        if (closed) return;
        closed = true;
        if (timer) clearTimeout(timer);
        if (rotation) clearTimeout(rotation);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          close();
        }
      };

      const tick = async () => {
        if (closed) return;
        try {
          const result = await getViewportAircraft({ ...viewport, filters });
          send("aircraft", result);
        } catch (error) {
          send("error", {
            error: "adsb_unavailable",
            message: "Live aircraft data temporarily unavailable.",
            detail: (error as Error).message,
          });
        }
        if (!closed) timer = setTimeout(tick, intervalMs);
      };

      request.signal.addEventListener("abort", close);

      // Hand off cleanly before the platform's function timeout can cut us off.
      rotation = setTimeout(() => {
        send("rotate", { reason: "stream_lifetime_reached" });
        close();
      }, config.adsb.streamLifetimeMs);

      send("open", { intervalMs, filters, lifetimeMs: config.adsb.streamLifetimeMs });
      await tick();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
