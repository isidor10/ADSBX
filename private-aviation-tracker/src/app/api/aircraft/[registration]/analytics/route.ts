import { jsonError, jsonOk } from "@/lib/api";
import { detectBase, detectRepositioning, getUtilisation } from "@/lib/flight/base";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/aircraft/:registration/analytics
 * Likely base, utilisation over 1/7/30/90 days, and potential repositioning
 * legs. Everything is derived from observed flights and labelled as inference.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ registration: string }> },
) {
  const { registration } = await params;
  try {
    const [base, utilisation, repositioning] = await Promise.all([
      detectBase(registration),
      getUtilisation(registration),
      detectRepositioning(registration),
    ]);
    return jsonOk({ base, utilisation, repositioning });
  } catch (error) {
    return jsonError(
      "analytics_unavailable",
      "Aircraft analytics temporarily unavailable.",
      502,
      (error as Error).message,
    );
  }
}
