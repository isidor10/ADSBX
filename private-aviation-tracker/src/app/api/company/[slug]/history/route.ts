import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api";
import { getCompanyRegistrations } from "@/lib/company/service";
import { getFleetHistory, windowFromDays } from "@/lib/history/costed";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/company/:slug/history?days=30 (or ?from=&to=)
 *
 * Fleet-wide costed history: totals, per aircraft, per route, and every
 * flight. All figures are estimates over observed flights, with the coverage
 * percentage attached so partial data is never read as a complete picture.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const q = request.nextUrl.searchParams;

  const from = q.get("from") ? new Date(q.get("from")!) : null;
  const to = q.get("to") ? new Date(q.get("to")!) : null;
  const days = Math.min(Math.max(Number(q.get("days") ?? 30), 1), 365);
  const window =
    from && to && !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())
      ? { from, to }
      : windowFromDays(days);

  try {
    const registrations = await getCompanyRegistrations(slug);
    return jsonOk(await getFleetHistory(slug, registrations, window));
  } catch (error) {
    return jsonError(
      "history_unavailable",
      "Fleet history temporarily unavailable.",
      502,
      (error as Error).message,
    );
  }
}
