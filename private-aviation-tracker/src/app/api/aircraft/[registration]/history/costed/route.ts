import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api";
import { getCostedHistory, windowFromDays } from "@/lib/history/costed";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/aircraft/:registration/history/costed?days=30
 * GET /api/aircraft/:registration/history/costed?from=ISO&to=ISO
 *
 * Every observed flight in the period with an estimated cost attached, plus
 * the coverage percentage — how much of the requested window this deployment
 * was actually watching.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ registration: string }> },
) {
  const { registration } = await params;
  const q = request.nextUrl.searchParams;

  const from = q.get("from") ? new Date(q.get("from")!) : null;
  const to = q.get("to") ? new Date(q.get("to")!) : null;
  const days = Math.min(Math.max(Number(q.get("days") ?? 30), 1), 365);

  const window =
    from && to && !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())
      ? { from, to }
      : windowFromDays(days);

  if (window.from >= window.to) {
    return jsonError("invalid_range", "The start of the range must be before its end.", 400);
  }

  try {
    return jsonOk(await getCostedHistory(registration, window));
  } catch (error) {
    return jsonError(
      "history_unavailable",
      "Flight history temporarily unavailable.",
      502,
      (error as Error).message,
    );
  }
}
