import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api";
import { getHistory } from "@/lib/history/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/aircraft/:registration/history
 * Recorded flights, positions and a derived timeline. Returns an explanatory
 * note rather than fabricated flights when nothing has been observed.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ registration: string }> },
) {
  const { registration } = await params;
  const search = request.nextUrl.searchParams;

  try {
    const history = await getHistory(registration, {
      flightLimit: Number(search.get("flights") ?? 20),
      positionLimit: Number(search.get("positions") ?? 200),
    });
    return jsonOk(history);
  } catch (error) {
    return jsonError(
      "history_unavailable",
      "Flight history temporarily unavailable.",
      502,
      (error as Error).message,
    );
  }
}
