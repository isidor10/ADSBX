import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api";
import { globalSearch } from "@/lib/search/global";
import { searchAircraft } from "@/lib/search/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/search?q=[&mode=aircraft]
 *
 * Categorised results across aircraft, companies, owners, operators and
 * airports. `mode=aircraft` returns the flat aircraft-only list, which is what
 * callers that just want to locate a tail number use.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = params.get("q")?.trim() ?? "";
  const limit = Number(params.get("limit") ?? 8);

  if (q.length < 2) {
    return jsonOk(
      params.get("mode") === "aircraft"
        ? { query: q, results: [] }
        : { query: q, aircraft: [], companies: [], owners: [], operators: [], airports: [] },
    );
  }

  try {
    if (params.get("mode") === "aircraft") {
      return jsonOk({ query: q, results: await searchAircraft(q, limit * 3) });
    }
    // The viewport lets company search fall back to aircraft actually in
    // coverage when no database is configured.
    const lat = Number(params.get("lat"));
    const lon = Number(params.get("lon"));
    const radiusNm = Number(params.get("radius"));
    const viewport =
      Number.isFinite(lat) && Number.isFinite(lon) && Number.isFinite(radiusNm)
        ? { lat, lon, radiusNm }
        : undefined;

    return jsonOk(await globalSearch(q, limit, viewport));
  } catch (error) {
    return jsonError("search_failed", "Search temporarily unavailable.", 502, (error as Error).message);
  }
}
