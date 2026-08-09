import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api";
import { searchAircraft } from "@/lib/search/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/search?q=
 * Searches registration, callsign, ICAO hex, model, owner and operator across
 * live traffic and stored records.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return jsonOk({ query: q, results: [] });
  }

  try {
    const results = await searchAircraft(q, Number(request.nextUrl.searchParams.get("limit") ?? 25));
    return jsonOk({ query: q, results });
  } catch (error) {
    return jsonError("search_failed", "Search temporarily unavailable.", 502, (error as Error).message);
  }
}
