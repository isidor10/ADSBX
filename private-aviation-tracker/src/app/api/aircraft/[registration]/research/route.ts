import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api";
import { getIdentity } from "@/lib/aircraft/service";
import { researchAircraft } from "@/lib/research/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/aircraft/:registration/research?refresh=1
 * Public news and forum coverage, each item labelled with how far it can be
 * trusted. Search happens here on the server; no key reaches the browser.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ registration: string }> },
) {
  const { registration } = await params;
  const refresh = request.nextUrl.searchParams.get("refresh") === "1";

  try {
    const identity = await getIdentity(registration);
    const report = await researchAircraft(
      registration,
      { model: identity?.model ?? null },
      refresh,
    );
    return jsonOk(report);
  } catch (error) {
    return jsonError(
      "research_unavailable",
      "Web research temporarily unavailable.",
      502,
      (error as Error).message,
    );
  }
}
