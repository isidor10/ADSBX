import type { NextRequest } from "next/server";
import { jsonError, jsonOk, parseFilters, parseViewport } from "@/lib/api";
import { adsbConfigured, config } from "@/lib/config";
import { getViewportAircraft } from "@/lib/live/feedManager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/aircraft/live?lat=&lon=&radius=&filters=
 *
 * Live aircraft for a map viewport, already filtered to the requested
 * categories. Upstream is polled at most once per interval per viewport cell,
 * shared across every connected client.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  if (!adsbConfigured()) {
    return jsonError(
      "adsb_not_configured",
      "Live aircraft data temporarily unavailable.",
      503,
      `ADS-B provider "${config.adsb.provider}" is missing credentials. Set the matching API key, or use ADSB_PROVIDER=demo for simulated data.`,
    );
  }

  const viewport = parseViewport(params);
  if ("error" in viewport) {
    return jsonError("invalid_request", viewport.error, 400);
  }

  try {
    const result = await getViewportAircraft({
      ...viewport,
      filters: parseFilters(params.get("filters")),
    });
    return jsonOk(result);
  } catch (error) {
    return jsonError(
      "adsb_unavailable",
      "Live aircraft data temporarily unavailable.",
      502,
      (error as Error).message,
    );
  }
}
