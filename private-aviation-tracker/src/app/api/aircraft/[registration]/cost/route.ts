import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api";
import { getIdentity } from "@/lib/aircraft/service";
import { estimateFlightCost } from "@/lib/cost/calculator";
import { findAirport } from "@/lib/flight/airports";
import { detectBase } from "@/lib/flight/base";
import { getCurrentFlight, getLastLanding } from "@/lib/flight/currentFlight";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/aircraft/:registration/cost?mode=DIRECT|FULL&from=&to=&fuel=
 *
 * Estimated operating cost for the aircraft's current flight, or for an
 * explicit city pair when `from`/`to` are supplied. FULL mode adds the
 * positioning legs to and from the likely base.
 *
 * Returns 422 rather than a fabricated number when neither end of the route
 * can be established — a cost with an invented destination would be worse
 * than no cost at all.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ registration: string }> },
) {
  const { registration } = await params;
  const q = request.nextUrl.searchParams;
  const mode = q.get("mode") === "FULL" ? "FULL" : "DIRECT";

  try {
    const [identity, flight, base, lastLanding] = await Promise.all([
      getIdentity(registration),
      getCurrentFlight(registration),
      detectBase(registration),
      getLastLanding(registration),
    ]);

    // Explicit city pair wins; otherwise use the live flight, and fall back to
    // the last completed flight when the aircraft is on the ground.
    const [fromOverride, toOverride] = await Promise.all([
      findAirport(q.get("from")),
      findAirport(q.get("to")),
    ]);

    const from = fromOverride ?? flight?.departure ?? lastLanding?.departure ?? null;
    const to = toOverride ?? flight?.destination ?? lastLanding?.arrival ?? null;

    if (!from || !to) {
      return jsonError(
        "route_unknown",
        "Cannot estimate a cost without both ends of the route.",
        422,
        "No departure/destination is known for this aircraft, and none was supplied. Pass ?from=ICAO&to=ICAO to price a specific route.",
      );
    }

    const fuelOverride = Number(q.get("fuel"));
    const estimate = estimateFlightCost({
      registration: registration.toUpperCase(),
      typeCode: identity?.typeCode ?? null,
      aircraftCategory: identity?.category ?? null,
      from,
      to,
      base: base.known ? base.airport : null,
      mode,
      fuelPricePerLitre: Number.isFinite(fuelOverride) && fuelOverride > 0 ? fuelOverride : undefined,
    });

    if (!estimate) {
      return jsonError("route_invalid", "The two airports resolve to the same position.", 422);
    }

    return jsonOk({
      estimate,
      base,
      routeSource: fromOverride || toOverride
        ? "USER_SUPPLIED"
        : flight?.destination
          ? flight.destinationSource
          : "OBSERVED",
      // FULL mode is only meaningful once a base has been inferred.
      fullModeAvailable: base.known,
    });
  } catch (error) {
    return jsonError(
      "cost_unavailable",
      "Cost estimate temporarily unavailable.",
      502,
      (error as Error).message,
    );
  }
}
