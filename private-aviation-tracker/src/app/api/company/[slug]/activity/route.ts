import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api";
import { getCompanyActivity } from "@/lib/company/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/company/:slug/activity?registration=&airport=&since=&until=&limit=
 * Observed flight activity for the fleet, newest first.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const q = request.nextUrl.searchParams;

  try {
    const activity = await getCompanyActivity(slug, {
      registration: q.get("registration") ?? undefined,
      airport: q.get("airport") ?? undefined,
      since: q.get("since") ?? undefined,
      until: q.get("until") ?? undefined,
      limit: q.get("limit") ? Number(q.get("limit")) : undefined,
    });
    return jsonOk(activity);
  } catch (error) {
    return jsonError(
      "activity_unavailable",
      "Flight activity temporarily unavailable.",
      502,
      (error as Error).message,
    );
  }
}
