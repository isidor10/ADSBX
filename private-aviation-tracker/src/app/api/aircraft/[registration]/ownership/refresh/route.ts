import type { NextRequest } from "next/server";
import { getIdentity, getLiveAircraft } from "@/lib/aircraft/service";
import { jsonError, jsonOk } from "@/lib/api";
import { refreshOwnership } from "@/lib/ownership/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/aircraft/:registration/ownership/refresh
 * Bypasses every cache and re-researches the registration from scratch.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ registration: string }> },
) {
  const { registration } = await params;

  try {
    const [identity, live] = await Promise.all([
      getIdentity(registration),
      getLiveAircraft(registration),
    ]);

    const result = await refreshOwnership(registration, {
      hints: {
        manufacturer: identity?.manufacturer,
        model: identity?.model,
        typeCode: identity?.typeCode,
        operatorHint: live?.feedOperator ?? null,
      },
      blocked: live?.isBlocked,
    });
    return jsonOk(result);
  } catch (error) {
    return jsonError(
      "ownership_refresh_failed",
      "Ownership information temporarily unavailable.",
      502,
      (error as Error).message,
    );
  }
}
