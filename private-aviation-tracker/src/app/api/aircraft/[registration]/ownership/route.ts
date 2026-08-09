import type { NextRequest } from "next/server";
import { getIdentity, getLiveAircraft } from "@/lib/aircraft/service";
import { jsonError, jsonOk } from "@/lib/api";
import { getOwnership } from "@/lib/ownership/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/aircraft/:registration/ownership
 * Runs (or serves the cached result of) the ownership research pipeline.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ registration: string }> },
) {
  const { registration } = await params;

  try {
    const [identity, live] = await Promise.all([
      getIdentity(registration),
      getLiveAircraft(registration),
    ]);

    const result = await getOwnership(registration, {
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
      "ownership_unavailable",
      "Ownership information temporarily unavailable.",
      502,
      (error as Error).message,
    );
  }
}
