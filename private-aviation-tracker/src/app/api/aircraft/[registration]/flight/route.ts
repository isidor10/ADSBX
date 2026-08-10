import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api";
import { getCurrentFlight, getLastLanding, getSelectedRoute } from "@/lib/flight/currentFlight";
import { getNextTrip } from "@/lib/flight/nextTrip";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/aircraft/:registration/flight?minutes=120
 *
 * Everything about where this aircraft is going and where it has been:
 * the current flight with destination and ETA, the geometry the map needs to
 * draw the route, the last completed landing, and a next trip only when one
 * can be established from repeated observed behaviour.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ registration: string }> },
) {
  const { registration } = await params;
  const minutes = Number(request.nextUrl.searchParams.get("minutes") ?? 120);

  try {
    const [current, route, lastLanding, nextTrip] = await Promise.all([
      getCurrentFlight(registration),
      getSelectedRoute(registration, { minutes }),
      getLastLanding(registration),
      getNextTrip(registration),
    ]);

    if (!current) {
      return jsonError("not_found", "Unknown registration.", 404);
    }

    return jsonOk({ current, route, lastLanding, nextTrip });
  } catch (error) {
    return jsonError(
      "flight_unavailable",
      "Flight information temporarily unavailable.",
      502,
      (error as Error).message,
    );
  }
}
