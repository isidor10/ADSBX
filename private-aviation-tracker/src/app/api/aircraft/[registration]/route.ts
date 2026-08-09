import type { NextRequest } from "next/server";
import { getAircraftDetail } from "@/lib/aircraft/service";
import { jsonError, jsonOk } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/aircraft/:registration
 * Identity, live position and last known position. Pass ?ownership=1 to run
 * the ownership pipeline in the same request.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ registration: string }> },
) {
  const { registration } = await params;
  const includeOwnership = request.nextUrl.searchParams.get("ownership") === "1";

  try {
    const detail = await getAircraftDetail(registration, { includeOwnership });
    if (!detail) {
      return jsonError(
        "not_found",
        `No information is available for ${registration.toUpperCase()}.`,
        404,
      );
    }
    return jsonOk(detail);
  } catch (error) {
    return jsonError(
      "aircraft_lookup_failed",
      "Aircraft information temporarily unavailable.",
      502,
      (error as Error).message,
    );
  }
}
